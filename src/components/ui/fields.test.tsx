import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { Card, Input, Select } from './index';

afterEach(cleanup);
it('uses a native button for an actionable card and a static container otherwise', () => {
  const open = vi.fn();
  const view = render(<Card onClick={open}>Pedido OV-1</Card>);
  const button = screen.getByRole('button', { name: 'Pedido OV-1' });
  expect(button).toHaveAttribute('type', 'button');
  fireEvent.click(button);
  expect(open).toHaveBeenCalledTimes(1);
  view.rerender(<Card>Información</Card>);
  expect(screen.queryByRole('button')).not.toBeInTheDocument();
});
it('associates labels with unique controls and preserves IDs and change callbacks', () => {
  const change = vi.fn();
  const view = render(<><Input label="Producto" onChange={change} /><Input label="Cliente" id="customer-id" /><Select label="Moneda" options={[{ value: 'GTQ', label: 'Quetzales' }]} /></>);
  const product = screen.getByLabelText('Producto');
  const currency = screen.getByLabelText('Moneda');
  expect(product.id).toBeTruthy();
  expect(product.id).not.toBe(currency.id);
  expect(screen.getByLabelText('Cliente')).toHaveAttribute('id', 'customer-id');
  const id = product.id;
  fireEvent.change(product, { target: { value: 'I1' } });
  expect(change).toHaveBeenCalledTimes(1);
  view.rerender(<><Input label="Producto" onChange={change} /><Input label="Cliente" id="customer-id" /><Select label="Moneda" options={[{ value: 'GTQ', label: 'Quetzales' }]} /></>);
  expect(screen.getByLabelText('Producto')).toHaveAttribute('id', id);
});
