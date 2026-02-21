import { render, screen } from '@testing-library/react';
import App from './App';

describe('App', () => {
  it('renderiza el header', () => {
    render(<App />);
    expect(screen.getByText('Debt Tech Remover')).toBeInTheDocument();
  });
});
