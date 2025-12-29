import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';


// Simple component to test setup
const TestComponent = () => <div>Hello Vitest</div>;

describe('Frontend Setup', () => {
    it('should pass a basic test', () => {
        expect(true).toBe(true);
    });

    it('should render a component', () => {
        render(<TestComponent />);
        expect(screen.getByText('Hello Vitest')).toBeInTheDocument();
    });
});
