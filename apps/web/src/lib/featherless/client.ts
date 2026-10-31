import { z } from 'zod';

export interface FeatherlessMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface FeatherlessRequestOptions {
  model?: string;
  temperature?: number;
  max_tokens?: number;
  response_format?: { type: 'json_object' };
  timeoutMs?: number;
}

export interface FeatherlessUsage {
  prompt_tokens: number;
  completion_tokens: number;
  total_tokens: number;
}

export interface FeatherlessResponse {
  content: string;
  usage: FeatherlessUsage;
  model: string;
}

class Semaphore {
  private current = 0;
  private queue: (() => void)[] = [];

  constructor(private max: number) {}

  async acquire(): Promise<void> {
    if (this.current < this.max) {
      this.current++;
      return;
    }
    await new Promise<void>((resolve) => this.queue.push(resolve));
    this.current++;
  }

  release(): void {
    this.current--;
    if (this.queue.length > 0) {
      const next = this.queue.shift();
      if (next) next();
    }
  }
}

export class FeatherlessClient {
  private apiKey: string;
  private baseUrl: string;
  private defaultGeneratorModel: string;
  private defaultAssistantModel: string;
  private defaultValidatorModel: string;
  private concurrencyLimiter: Semaphore;

  constructor() {
    this.apiKey = process.env.FEATHERLESS_API_KEY || '';
    this.baseUrl = (process.env.FEATHERLESS_BASE_URL || 'https://api.featherless.ai/v1').replace(/\/+$/, '');
    this.defaultGeneratorModel = process.env.FEATHERLESS_MODEL_GENERATOR || 'deepseek-ai/DeepSeek-V4-Pro';
    this.defaultAssistantModel = process.env.FEATHERLESS_MODEL_ASSISTANT || 'deepseek-ai/DeepSeek-V4-Pro';
    this.defaultValidatorModel = process.env.FEATHERLESS_MODEL_VALIDATOR || 'deepseek-ai/DeepSeek-V4-Pro';
    
    const maxConcurrency = parseInt(process.env.FEATHERLESS_CONCURRENCY_LIMIT || '4', 10);
    this.concurrencyLimiter = new Semaphore(maxConcurrency);
  }

  getGeneratorModel(): string { return this.defaultGeneratorModel; }
  getAssistantModel(): string { return this.defaultAssistantModel; }
  getValidatorModel(): string { return this.defaultValidatorModel; }

  async chatCompletion(
    messages: FeatherlessMessage[],
    options: FeatherlessRequestOptions = {}
  ): Promise<FeatherlessResponse> {
    await this.concurrencyLimiter.acquire();
    try {
      return await this._callWithBackoff(messages, options);
    } finally {
      this.concurrencyLimiter.release();
    }
  }

  private async _callWithBackoff(
    messages: FeatherlessMessage[],
    options: FeatherlessRequestOptions,
    retries = 3
  ): Promise<FeatherlessResponse> {
    const timeoutMs = options.timeoutMs || 45000;
    const model = options.model || this.defaultGeneratorModel;

    let delay = 1000;
    for (let attempt = 1; attempt <= retries; attempt++) {
      try {
        const controller = new AbortController();
        const timeoutHandle = setTimeout(() => controller.abort(), timeoutMs);

        const response = await fetch(`${this.baseUrl}/chat/completions`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${this.apiKey}`
          },
          body: JSON.stringify({
            model,
            messages,
            temperature: options.temperature ?? 0.2,
            max_tokens: options.max_tokens ?? 2500,
            response_format: options.response_format
          }),
          signal: controller.signal
        });

        clearTimeout(timeoutHandle);

        if (!response.ok) {
          const errText = await response.text();
          if (response.status === 429 || response.status >= 500) {
            throw new Error(`Featherless API server error [${response.status}]: ${errText}`);
          }
          throw new Error(`Featherless API request rejected [${response.status}]: ${errText}`);
        }

        const data = await response.json();
        const content = data.choices?.[0]?.message?.content || '';
        const usage: FeatherlessUsage = data.usage || { prompt_tokens: 0, completion_tokens: 0, total_tokens: 0 };

        // Observability logging
        console.log(`[Featherless] Model: ${model} | Tokens: ${usage.total_tokens} (prompt: ${usage.prompt_tokens}, comp: ${usage.completion_tokens})`);

        return { content, usage, model };
      } catch (err: any) {
        if (attempt === retries) {
          throw err;
        }
        console.warn(`[Featherless] Attempt ${attempt} failed: ${err.message}. Retrying in ${delay}ms...`);
        await new Promise((res) => setTimeout(res, delay));
        delay *= 2;
      }
    }

    throw new Error('Featherless completion failed after all retries');
  }

  // Structured Output with Zod Validation and Automated Repair Re-prompt
  async structuredCompletion<T>(
    messages: FeatherlessMessage[],
    schema: z.ZodType<T>,
    options: FeatherlessRequestOptions = {}
  ): Promise<{ data: T; usage: FeatherlessUsage }> {
    const conversation = [...messages];
    const totalUsage: FeatherlessUsage = { prompt_tokens: 0, completion_tokens: 0, total_tokens: 0 };

    for (let repairAttempt = 0; repairAttempt <= 2; repairAttempt++) {
      const resp = await this.chatCompletion(conversation, {
        ...options,
        response_format: { type: 'json_object' }
      });

      totalUsage.prompt_tokens += resp.usage.prompt_tokens;
      totalUsage.completion_tokens += resp.usage.completion_tokens;
      totalUsage.total_tokens += resp.usage.total_tokens;

      try {
        const rawJson = JSON.parse(resp.content);
        const parsed = schema.safeParse(rawJson);
        if (parsed.success) {
          return { data: parsed.data, usage: totalUsage };
        }

        // Schema validation failed - prepare repair re-prompt
        const errorDetails = parsed.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join(', ');
        console.warn(`[Featherless] Schema mismatch on attempt ${repairAttempt + 1}: ${errorDetails}`);

        conversation.push({ role: 'assistant', content: resp.content });
        conversation.push({
          role: 'user',
          content: `Your previous JSON output failed schema validation with errors: ${errorDetails}. Please output ONLY a corrected valid JSON object satisfying the exact required schema.`
        });
      } catch (jsonErr: any) {
        console.warn(`[Featherless] JSON parsing failure on attempt ${repairAttempt + 1}: ${jsonErr.message}`);
        conversation.push({ role: 'assistant', content: resp.content });
        conversation.push({
          role: 'user',
          content: `Your previous response was not valid JSON: ${jsonErr.message}. Output ONLY a raw, valid JSON object.`
        });
      }
    }

    throw new Error('Failed to obtain schema-compliant structured output from Featherless AI after 2 repair attempts');
  }
}

export const featherlessClient = new FeatherlessClient();

