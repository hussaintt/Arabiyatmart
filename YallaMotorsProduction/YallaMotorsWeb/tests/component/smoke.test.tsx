'use client';

import React, { useState } from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect } from 'vitest';

export function TestSmokeComponent({
  initialTitle = 'عربيات مارت',
}: {
  readonly initialTitle?: string;
}) {
  const [clicks, setClicks] = useState(0);

  return (
    <div data-testid="smoke-component">
      <h1 data-testid="smoke-title">{initialTitle}</h1>
      <p data-testid="smoke-counter">{clicks}</p>
      <button
        type="button"
        onClick={() => setClicks((prev) => prev + 1)}
        data-testid="smoke-button"
      >
        زيادة
      </button>
    </div>
  );
}

describe('TestSmokeComponent [Client Component]', () => {
  it('renders initial state with localized Arabic text and updates on interaction', () => {
    render(<TestSmokeComponent />);

    const title = screen.getByTestId('smoke-title');
    expect(title).toBeInTheDocument();
    expect(title).toHaveTextContent('عربيات مارت');

    const counter = screen.getByTestId('smoke-counter');
    expect(counter).toHaveTextContent('0');

    const button = screen.getByTestId('smoke-button');
    fireEvent.click(button);

    expect(counter).toHaveTextContent('1');
  });
});
