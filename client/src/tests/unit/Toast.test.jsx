import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import Toast from '../../components/Toast';
import { ThemeProvider } from '../../context/ThemeContext';

const renderWithTheme = (component) => {
  return render(<ThemeProvider>{component}</ThemeProvider>);
};

describe('Toast Component', () => {
  const mockOnClose = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('Rendering', () => {
    it('should render toast with message', () => {
      renderWithTheme(<Toast message="Test message" onClose={mockOnClose} />);
      expect(screen.getByText('Test message')).toBeInTheDocument();
    });

    it('should render with info type by default', () => {
      renderWithTheme(<Toast message="Info message" onClose={mockOnClose} />);
      const toast = screen.getByText('Info message').parentElement.parentElement;
      expect(toast).toHaveClass('bg-blue-50');
    });

    it('should render with success type', () => {
      renderWithTheme(<Toast message="Success message" type="success" onClose={mockOnClose} />);
      const toast = screen.getByText('Success message').parentElement.parentElement;
      expect(toast).toHaveClass('bg-green-50');
    });

    it('should render with error type', () => {
      renderWithTheme(<Toast message="Error message" type="error" onClose={mockOnClose} />);
      const toast = screen.getByText('Error message').parentElement.parentElement;
      expect(toast).toHaveClass('bg-red-50');
    });

    it('should render with warning type', () => {
      renderWithTheme(<Toast message="Warning message" type="warning" onClose={mockOnClose} />);
      const toast = screen.getByText('Warning message').parentElement.parentElement;
      expect(toast).toHaveClass('bg-amber-50');
    });
  });

  describe('Auto-dismiss', () => {
    it('should auto-dismiss after default duration (4000ms)', async () => {
      renderWithTheme(<Toast message="Auto dismiss" onClose={mockOnClose} />);
      
      expect(mockOnClose).not.toHaveBeenCalled();
      
      // Run all timers to trigger the timeout
      await vi.runAllTimersAsync();
      
      expect(mockOnClose).toHaveBeenCalledTimes(1);
    });

    it('should auto-dismiss after custom duration', async () => {
      renderWithTheme(<Toast message="Custom duration" duration={2000} onClose={mockOnClose} />);
      
      expect(mockOnClose).not.toHaveBeenCalled();
      
      // Run all timers to trigger the timeout
      await vi.runAllTimersAsync();
      
      expect(mockOnClose).toHaveBeenCalledTimes(1);
    });

    it('should not auto-dismiss when duration is 0', async () => {
      renderWithTheme(<Toast message="No auto-dismiss" duration={0} onClose={mockOnClose} />);
      
      vi.advanceTimersByTime(10000);
      
      expect(mockOnClose).not.toHaveBeenCalled();
    });
  });

  describe('Manual Close', () => {
    it('should close when close button is clicked', async () => {
      // Use real timers for this test to avoid conflicts with user interaction
      vi.useRealTimers();
      
      const user = userEvent.setup();
      renderWithTheme(<Toast message="Click to close" onClose={mockOnClose} duration={0} />);
      
      const closeButton = screen.getByLabelText('Close notification');
      await user.click(closeButton);
      
      expect(mockOnClose).toHaveBeenCalledTimes(1);
      
      // Restore fake timers for other tests
      vi.useFakeTimers();
    });
  });

  describe('Icons', () => {
    it('should display success icon for success type', () => {
      renderWithTheme(<Toast message="Success" type="success" onClose={mockOnClose} />);
      const icon = screen.getByText('Success').parentElement.previousElementSibling;
      expect(icon).toBeInTheDocument();
      expect(icon.querySelector('svg')).toBeInTheDocument();
    });

    it('should display error icon for error type', () => {
      renderWithTheme(<Toast message="Error" type="error" onClose={mockOnClose} />);
      const icon = screen.getByText('Error').parentElement.previousElementSibling;
      expect(icon).toBeInTheDocument();
      expect(icon.querySelector('svg')).toBeInTheDocument();
    });

    it('should display warning icon for warning type', () => {
      renderWithTheme(<Toast message="Warning" type="warning" onClose={mockOnClose} />);
      const icon = screen.getByText('Warning').parentElement.previousElementSibling;
      expect(icon).toBeInTheDocument();
      expect(icon.querySelector('svg')).toBeInTheDocument();
    });

    it('should display info icon for info type', () => {
      renderWithTheme(<Toast message="Info" type="info" onClose={mockOnClose} />);
      const icon = screen.getByText('Info').parentElement.previousElementSibling;
      expect(icon).toBeInTheDocument();
      expect(icon.querySelector('svg')).toBeInTheDocument();
    });
  });

  describe('Positioning', () => {
    it('should have animation wrapper', () => {
      renderWithTheme(<Toast message="Animated" onClose={mockOnClose} />);
      const wrapper = screen.getByText('Animated').closest('div').parentElement.parentElement;
      expect(wrapper).toHaveClass('animate-slideInRight');
    });

    it('should have flex layout for content', () => {
      renderWithTheme(<Toast message="Flex layout" onClose={mockOnClose} />);
      const container = screen.getByText('Flex layout').parentElement.parentElement;
      expect(container).toHaveClass('flex', 'items-start');
    });

    it('should have shadow styling', () => {
      renderWithTheme(<Toast message="Shadow" onClose={mockOnClose} />);
      const container = screen.getByText('Shadow').parentElement.parentElement;
      expect(container).toHaveClass('shadow-2xl');
    });
  });

  describe('Accessibility', () => {
    it('should have aria-label on close button', () => {
      renderWithTheme(<Toast message="Accessible" onClose={mockOnClose} />);
      const closeButton = screen.getByLabelText('Close notification');
      expect(closeButton).toBeInTheDocument();
    });

    it('should have close icon SVG', () => {
      renderWithTheme(<Toast message="Close icon" onClose={mockOnClose} />);
      const closeButton = screen.getByLabelText('Close notification');
      const svg = closeButton.querySelector('svg');
      expect(svg).toBeInTheDocument();
    });
  });

  describe('Animation', () => {
    it('should have animation class', () => {
      renderWithTheme(<Toast message="Animated" onClose={mockOnClose} />);
      const container = screen.getByText('Animated').parentElement.parentElement.parentElement;
      expect(container).toHaveClass('animate-slideInRight');
    });
  });
});
