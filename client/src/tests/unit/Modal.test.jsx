import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import Modal from '../../components/Modal';
import { ThemeProvider } from '../../context/ThemeContext';

const renderWithTheme = (component) => {
  return render(<ThemeProvider>{component}</ThemeProvider>);
};

describe('Modal Component', () => {
  const mockOnClose = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Visibility', () => {
    it('should not render when isOpen is false', () => {
      renderWithTheme(<Modal isOpen={false} onClose={mockOnClose}>Content</Modal>);
      expect(screen.queryByText('Content')).not.toBeInTheDocument();
    });

    it('should render when isOpen is true', () => {
      renderWithTheme(<Modal isOpen={true} onClose={mockOnClose}>Content</Modal>);
      expect(screen.getByText('Content')).toBeInTheDocument();
    });

    it('should render children content', () => {
      renderWithTheme(
        <Modal isOpen={true} onClose={mockOnClose}>
          <h1>Modal Title</h1>
          <p>Modal body text</p>
        </Modal>
      );
      expect(screen.getByText('Modal Title')).toBeInTheDocument();
      expect(screen.getByText('Modal body text')).toBeInTheDocument();
    });
  });

  describe('Closing Behavior', () => {
    it('should call onClose when close button is clicked', async () => {
      const user = userEvent.setup();
      renderWithTheme(<Modal isOpen={true} onClose={mockOnClose}>Content</Modal>);
      
      const closeButton = screen.getByLabelText('Close modal');
      await user.click(closeButton);
      
      expect(mockOnClose).toHaveBeenCalledTimes(1);
    });

    it('should call onClose when backdrop is clicked', async () => {
      const user = userEvent.setup();
      const { container } = renderWithTheme(<Modal isOpen={true} onClose={mockOnClose}>Content</Modal>);
      
      // The backdrop is the first child of the modal root (the fixed div with backdrop-blur)
      const backdrop = container.querySelector('.fixed.inset-0');
      await user.click(backdrop);
      
      expect(mockOnClose).toHaveBeenCalledTimes(1);
    });

    it('should not call onClose when modal content is clicked', async () => {
      const user = userEvent.setup();
      renderWithTheme(<Modal isOpen={true} onClose={mockOnClose}>Content</Modal>);
      
      const content = screen.getByText('Content');
      await user.click(content);
      
      expect(mockOnClose).not.toHaveBeenCalled();
    });
  });

  describe('Styling', () => {
    it('should have backdrop blur effect', () => {
      const { container } = renderWithTheme(<Modal isOpen={true} onClose={mockOnClose}>Content</Modal>);
      const backdrop = container.querySelector('.fixed.inset-0');
      // Accept any backdrop-blur variant (sm/md/etc.) — ensure presence of blur utility
      expect(backdrop.className).toMatch(/backdrop-blur/);
    });

    it('should have fixed positioning', () => {
      const { container } = renderWithTheme(<Modal isOpen={true} onClose={mockOnClose}>Content</Modal>);
      const backdrop = container.querySelector('.fixed.inset-0');
      expect(backdrop).toHaveClass('fixed', 'inset-0');
    });

    it('should have high z-index for overlay', () => {
      const { container } = renderWithTheme(<Modal isOpen={true} onClose={mockOnClose}>Content</Modal>);
      const backdrop = container.querySelector('.fixed.inset-0');
      expect(backdrop).toHaveClass('z-50');
    });

    it('should have rounded corners on modal content', () => {
      const { container } = renderWithTheme(<Modal isOpen={true} onClose={mockOnClose}>Content</Modal>);
      const modalContent = container.querySelector('.rounded-lg');
      expect(modalContent).toBeInTheDocument();
      expect(modalContent).toHaveClass('rounded-lg');
    });
  });

  describe('Accessibility', () => {
    it('should have close button with aria-label', () => {
      renderWithTheme(<Modal isOpen={true} onClose={mockOnClose}>Content</Modal>);
      const closeButton = screen.getByLabelText('Close modal');
      expect(closeButton).toBeInTheDocument();
    });

    it('should show close icon in button', () => {
      renderWithTheme(<Modal isOpen={true} onClose={mockOnClose}>Content</Modal>);
      const closeButton = screen.getByLabelText('Close modal');
      const svg = closeButton.querySelector('svg');
      expect(svg).toBeInTheDocument();
    });
  });

  describe('Multiple Children', () => {
    it('should render complex content structure', () => {
      renderWithTheme(
        <Modal isOpen={true} onClose={mockOnClose}>
          <div>
            <h2>Title</h2>
            <form>
              <input type="text" placeholder="Name" />
              <button type="submit">Submit</button>
            </form>
          </div>
        </Modal>
      );

      expect(screen.getByText('Title')).toBeInTheDocument();
      expect(screen.getByPlaceholderText('Name')).toBeInTheDocument();
      expect(screen.getByText('Submit')).toBeInTheDocument();
    });
  });
});
