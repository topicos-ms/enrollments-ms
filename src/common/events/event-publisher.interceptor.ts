import {
  CallHandler,
  ExecutionContext,
  Inject,
  Injectable,
  Logger,
  NestInterceptor,
} from '@nestjs/common';
import { ClientProxy } from '@nestjs/microservices';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';

export const EVENT_EMITTER = 'EVENT_EMITTER';

@Injectable()
export class EventPublisherInterceptor implements NestInterceptor {
  private readonly logger = new Logger(EventPublisherInterceptor.name);

  constructor(@Inject(EVENT_EMITTER) private readonly client: ClientProxy) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const rpcContext = context.switchToRpc();
    const requestPayload = rpcContext.getData();
    const args = context.getArgs();
    const pattern = (rpcContext as any).getPattern?.() ?? args[1];

    return next.handle().pipe(
      tap({
        next: (result) => {
          if (!pattern) {
            return;
          }

          const completionPattern = `${String(pattern)}.completed`;
          const payload = {
            pattern,
            result,
            request: requestPayload,
            emittedAt: new Date().toISOString(),
          };

          this.client.emit(completionPattern, payload).subscribe({
            error: (error) =>
              this.logger.warn(
                `Failed to emit completion event '${completionPattern}': ${error?.message ?? error}`,
              ),
          });
        },
      }),
    );
  }
}
