import { Button, Icon } from './index';

export const LoadingState = ({ message = 'Cargando...' }: { message?: string }) => <div className="min-h-[40vh] flex flex-col items-center justify-center gap-3 text-on-surface-variant"><Icon name="progress_activity" size={28} className="animate-spin text-primary" /><p className="text-sm">{message}</p></div>;
export const ErrorState = ({ message, onRetry }: { message: string; onRetry?: () => void }) => <div className="min-h-[40vh] flex flex-col items-center justify-center gap-3 text-center px-6"><Icon name="error" size={34} className="text-error" /><p className="text-sm text-on-surface">{message}</p>{onRetry && <Button onClick={onRetry}>Intentar nuevamente</Button>}</div>;
