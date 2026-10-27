import { Injectable, LoggerService, Scope } from '@nestjs/common';

@Injectable({ scope: Scope.DEFAULT })
export class StructuredLogger implements LoggerService {
  private sanitize(message: any): any {
    if (typeof message === 'string') {
      return message
        .replace(/(Bearer\s+)[A-Za-z0-9\-_=.]+/gi, '$1[REDACTED_TOKEN]')
        .replace(/(password["']?\s*[:=]\s*["'])[^"']+["']/gi, '$1[REDACTED_PASSWORD]"')
        .replace(/(secret["']?\s*[:=]\s*["'])[^"']+["']/gi, '$1[REDACTED_SECRET]"');
    }
    if (typeof message === 'object' && message !== null) {
      const copy: Record<string, any> = {};
      for (const [key, val] of Object.entries(message)) {
        if (/token|password|secret|key|authorization/i.test(key)) {
          copy[key] = '[REDACTED]';
        } else if (typeof val === 'object') {
          copy[key] = this.sanitize(val);
        } else {
          copy[key] = val;
        }
      }
      return copy;
    }
    return message;
  }

  private print(level: string, message: any, context?: string, trace?: string) {
    const entry = {
      timestamp: new Date().toISOString(),
      level,
      context: context || 'Application',
      message: this.sanitize(message),
      ...(trace ? { trace: this.sanitize(trace) } : {})
    };
    process.stdout.write(JSON.stringify(entry) + '\n');
  }

  log(message: any, context?: string) {
    this.print('INFO', message, context);
  }

  error(message: any, trace?: string, context?: string) {
    this.print('ERROR', message, context, trace);
  }

  warn(message: any, context?: string) {
    this.print('WARN', message, context);
  }

  debug?(message: any, context?: string) {
    if (process.env.NODE_ENV !== 'production') {
      this.print('DEBUG', message, context);
    }
  }
}
