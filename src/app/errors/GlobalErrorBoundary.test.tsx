import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { GlobalErrorBoundary } from './GlobalErrorBoundary';

class FailedBoundary extends GlobalErrorBoundary {
  state = { failed: true };
}

describe('GlobalErrorBoundary', () => {
  it('replaces an unhandled render failure with a safe recovery screen', () => {
    render(<FailedBoundary><p>sensitive detail</p></FailedBoundary>);
    expect(screen.getByRole('alert')).toHaveTextContent('Sales4App no pudo continuar');
    expect(screen.queryByText('sensitive detail')).not.toBeInTheDocument();
  });
});
