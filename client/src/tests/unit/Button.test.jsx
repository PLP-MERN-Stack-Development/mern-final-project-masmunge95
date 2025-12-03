import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import Button from '../../components/Button';

describe('Button Component', () => {
  const mockOnClick = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Rendering', () => {
    it('should render button with children', () => {
      render(<Button onClick={mockOnClick}>Click Me</Button>);
      expect(screen.getByText('Click Me')).toBeInTheDocument();
    });

    it('should render with primary variant by default', () => {
      render(<Button onClick={mockOnClick}>Primary</Button>);
      const button = screen.getByText('Primary');
      expect(button).toHaveClass('bg-red-600');
    });

    it('should render with secondary variant', () => {
      render(<Button variant="secondary" onClick={mockOnClick}>Secondary</Button>);
      const button = screen.getByText('Secondary');
      expect(button).toHaveClass('bg-gray-200');
    });

    it('should render with danger variant', () => {
      render(<Button variant="danger" onClick={mockOnClick}>Danger</Button>);
      const button = screen.getByText('Danger');
      expect(button).toHaveClass('bg-red-600');
    });

    it('should render with success variant', () => {
      render(<Button variant="success" onClick={mockOnClick}>Success</Button>);
      const button = screen.getByText('Success');
      expect(button).toHaveClass('bg-green-600');
    });

    it('should render with warning variant', () => {
      render(<Button variant="warning" onClick={mockOnClick}>Warning</Button>);
      const button = screen.getByText('Warning');
      expect(button).toHaveClass('bg-yellow-500');
    });
  });

  describe('Sizes', () => {
    it('should render with medium size by default', () => {
      render(<Button onClick={mockOnClick}>Medium</Button>);
      const button = screen.getByText('Medium');
      expect(button).toHaveClass('px-4', 'py-2');
    });

    it('should render with small size', () => {
      render(<Button size="sm" onClick={mockOnClick}>Small</Button>);
      const button = screen.getByText('Small');
      expect(button).toHaveClass('px-2', 'py-1', 'text-sm');
    });

    it('should render with large size', () => {
      render(<Button size="lg" onClick={mockOnClick}>Large</Button>);
      const button = screen.getByText('Large');
      expect(button).toHaveClass('px-6', 'py-3', 'text-lg');
    });
  });

  describe('Disabled State', () => {
    it('should render disabled button', () => {
      render(<Button disabled onClick={mockOnClick}>Disabled</Button>);
      const button = screen.getByText('Disabled');
      expect(button).toBeDisabled();
      expect(button).toHaveClass('opacity-50', 'cursor-not-allowed');
    });

    it('should not call onClick when disabled', async () => {
      const user = userEvent.setup();
      render(<Button disabled onClick={mockOnClick}>Disabled</Button>);
      const button = screen.getByText('Disabled');
      
      await user.click(button);
      expect(mockOnClick).not.toHaveBeenCalled();
    });
  });

  describe('Interaction', () => {
    it('should call onClick when clicked', async () => {
      const user = userEvent.setup();
      render(<Button onClick={mockOnClick}>Click Me</Button>);
      const button = screen.getByText('Click Me');
      
      await user.click(button);
      expect(mockOnClick).toHaveBeenCalledTimes(1);
    });

    it('should call onClick multiple times', async () => {
      const user = userEvent.setup();
      render(<Button onClick={mockOnClick}>Click Me</Button>);
      const button = screen.getByText('Click Me');
      
      await user.click(button);
      await user.click(button);
      await user.click(button);
      
      expect(mockOnClick).toHaveBeenCalledTimes(3);
    });

    it('should be focusable', async () => {
      const user = userEvent.setup();
      render(<Button onClick={mockOnClick}>Focusable</Button>);
      const button = screen.getByText('Focusable');
      
      await user.tab();
      expect(button).toHaveFocus();
    });
  });

  describe('Custom Props', () => {
    it('should accept custom className', () => {
      render(<Button className="custom-class" onClick={mockOnClick}>Custom</Button>);
      const button = screen.getByText('Custom');
      expect(button).toHaveClass('custom-class');
    });

    it('should pass through additional props', () => {
      render(<Button data-testid="test-button" onClick={mockOnClick}>Test</Button>);
      const button = screen.getByTestId('test-button');
      expect(button).toBeInTheDocument();
    });

    it('should accept type attribute', () => {
      render(<Button type="submit" onClick={mockOnClick}>Submit</Button>);
      const button = screen.getByText('Submit');
      expect(button).toHaveAttribute('type', 'submit');
    });
  });

  describe('Accessibility', () => {
    it('should have focus ring classes', () => {
      render(<Button onClick={mockOnClick}>Accessible</Button>);
      const button = screen.getByText('Accessible');
      expect(button).toHaveClass('focus:outline-none', 'focus:ring-2');
    });

    it('should be keyboard accessible', async () => {
      const user = userEvent.setup();
      render(<Button onClick={mockOnClick}>Keyboard</Button>);
      const button = screen.getByText('Keyboard');
      
      await user.tab();
      expect(button).toHaveFocus();
      
      await user.keyboard('{Enter}');
      expect(mockOnClick).toHaveBeenCalledTimes(1);
    });

    it('should work with space key', async () => {
      const user = userEvent.setup();
      render(<Button onClick={mockOnClick}>Space</Button>);
      const button = screen.getByText('Space');
      
      await user.tab();
      await user.keyboard(' ');
      expect(mockOnClick).toHaveBeenCalledTimes(1);
    });
  });
});
