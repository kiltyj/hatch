import {Breadcrumb, Options,  Severity} from '@sentry/types';
import {Action, ErrorReporter} from './ErrorReporter';
import {SentryMonitor} from './SentryMonitor';

export default class SentryReporter implements ErrorReporter {
  private readonly initialized: boolean = false;
  private initializedWarningShown: boolean = false;

  constructor(private readonly sentry: SentryMonitor, options: Options) {
    if (options && options.dsn) {
      this.sentry.init({dsn: options.dsn, integrations: options.integrations});
      this.initialized = true;
    } else {
      this.initialized = false;
    }
    console.log('Error reporting initialized: ' + this.initialized);
  }

  public captureAction(action: Action, prevState: any) {
    if (this.initialized) {
      try {
        this.sentry.setExtra('stateBeforeLastAction', prevState);
        const breadcrumb: Breadcrumb = {
          level: Severity.Info,
          category: 'action',
          message: action.type,
        };
        if (action.payload != null) {
          breadcrumb.data = {payload: action.payload};
        }
        this.sentry.addBreadcrumb(breadcrumb);
      } catch (error) {
        console.error('Error reporting action: ' + error.message);
      }
    } else if (!this.initializedWarningShown) {
      this.initializedWarningShown = true;
      console.error('Error reporting actions: Sentry not initialized');
    }
  }

  public captureException(exception: Error) {
    if (this.initialized) {
      try {
        if (exception && exception.stack != null) {
          this.sentry.setExtra('exceptionContext', exception.stack);
        }
        this.sentry.captureException(exception);
      } catch (error) {
        console.error('Error reporting exception: ' + error.message);
      }
    }
  }

  public captureLog(message: string) {
    if (this.initialized) {
      try {
        const breadcrumb: Breadcrumb = {
          level: Severity.Info,
          category: 'log',
          message,
        };
        this.sentry.addBreadcrumb(breadcrumb);
      } catch (err) {
        // Ignore, to prevent infinite recursion
      }
    }
  }

}