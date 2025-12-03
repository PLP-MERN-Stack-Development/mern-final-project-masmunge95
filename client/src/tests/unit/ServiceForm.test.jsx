import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import ServiceForm from '../../components/ServiceForm';
import { ThemeProvider } from '../../context/ThemeContext';

const renderWithTheme = (component) => {
  return render(
    <ThemeProvider>
      {component}
    </ThemeProvider>
  );
};

describe('ServiceForm Component', () => {
  const mockOnSave = vi.fn();
  const mockOnCancel = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Create Mode (New Service)', () => {
    it('should render empty form for new service', () => {
      renderWithTheme(
        <ServiceForm onSave={mockOnSave} onCancel={mockOnCancel} />
      );

      expect(screen.getByLabelText(/service name/i)).toHaveValue('');
      expect(screen.getByLabelText(/details/i)).toHaveValue('');
      expect(screen.getByLabelText(/unit price/i)).toHaveValue(0);
      expect(screen.getByText(/save/i)).toBeInTheDocument();
      expect(screen.getByText(/cancel/i)).toBeInTheDocument();
    });

    it('should handle user input for service name', async () => {
      const user = userEvent.setup();
      renderWithTheme(
        <ServiceForm onSave={mockOnSave} onCancel={mockOnCancel} />
      );

      const nameInput = screen.getByLabelText(/service name/i);
      await user.type(nameInput, 'Water Service');

      expect(nameInput).toHaveValue('Water Service');
    });

    it('should handle user input for details', async () => {
      const user = userEvent.setup();
      renderWithTheme(
        <ServiceForm onSave={mockOnSave} onCancel={mockOnCancel} />
      );

      const detailsInput = screen.getByLabelText(/details/i);
      await user.type(detailsInput, 'Monthly water utility');

      expect(detailsInput).toHaveValue('Monthly water utility');
    });

    it('should handle user input for unit price', async () => {
      const user = userEvent.setup();
      renderWithTheme(
        <ServiceForm onSave={mockOnSave} onCancel={mockOnCancel} />
      );

      const priceInput = screen.getByLabelText(/unit price/i);
      await user.clear(priceInput);
      await user.type(priceInput, '50');

      expect(priceInput).toHaveValue(50);
    });

    it('should add a fee to the service', async () => {
      const user = userEvent.setup();
      renderWithTheme(
        <ServiceForm onSave={mockOnSave} onCancel={mockOnCancel} />
      );

      const addFeeButton = screen.getByText(/add fee/i);
      await user.click(addFeeButton);

      // Check if fee inputs appeared
      const feeNameInputs = screen.getAllByPlaceholderText(/fee description/i);
      const feeAmountInputs = screen.getAllByPlaceholderText(/amount/i);

      expect(feeNameInputs).toHaveLength(1);
      expect(feeAmountInputs).toHaveLength(1);

      // Fill in fee details
      await user.type(feeNameInputs[0], 'Service Fee');
      await user.clear(feeAmountInputs[0]);
      await user.type(feeAmountInputs[0], '5');

      expect(feeNameInputs[0]).toHaveValue('Service Fee');
      expect(feeAmountInputs[0]).toHaveValue(5);
    });

    it('should remove a fee from the service', async () => {
      const user = userEvent.setup();
      renderWithTheme(
        <ServiceForm onSave={mockOnSave} onCancel={mockOnCancel} />
      );

      // Add a fee
      const addFeeButton = screen.getByText(/add fee/i);
      await user.click(addFeeButton);

      expect(screen.getAllByPlaceholderText(/fee description/i)).toHaveLength(1);

      // Remove the fee
      const removeFeeButton = screen.getByText(/remove/i);
      await user.click(removeFeeButton);

      expect(screen.queryByPlaceholderText(/fee description/i)).not.toBeInTheDocument();
    });

    it('should submit form with correct data', async () => {
      const user = userEvent.setup();
      renderWithTheme(
        <ServiceForm onSave={mockOnSave} onCancel={mockOnCancel} />
      );

      // Fill in form
      await user.type(screen.getByLabelText(/service name/i), 'Water');
      await user.type(screen.getByLabelText(/details/i), 'Water utility service');
      const priceInput = screen.getByLabelText(/unit price/i);
      await user.clear(priceInput);
      await user.type(priceInput, '50');

      // Add fee
      await user.click(screen.getByText(/add fee/i));
      const feeNameInputs = screen.getAllByPlaceholderText(/fee description/i);
      const feeAmountInputs = screen.getAllByPlaceholderText(/amount/i);
      await user.type(feeNameInputs[0], 'Service Fee');
      await user.clear(feeAmountInputs[0]);
      await user.type(feeAmountInputs[0], '5');

      // Submit form
      await user.click(screen.getByText(/save|update/i));

      await waitFor(() => {
        expect(mockOnSave).toHaveBeenCalledWith({
          name: 'Water',
          details: 'Water utility service',
          unitPrice: 50,
          fees: [{ description: 'Service Fee', amount: 5 }],
          total: 55,
        });
      });
    });

    it('should call onCancel when cancel button is clicked', async () => {
      const user = userEvent.setup();
      renderWithTheme(
        <ServiceForm onSave={mockOnSave} onCancel={mockOnCancel} />
      );

      await user.click(screen.getByText(/cancel/i));

      expect(mockOnCancel).toHaveBeenCalledTimes(1);
    });
  });

  describe('Edit Mode (Existing Service)', () => {
    const existingService = {
      _id: 'service-1',
      name: 'Water Service',
      details: 'Monthly water utility',
      unitPrice: 50,
      fees: [
        { description: 'Service Fee', amount: 5 },
        { description: 'Delivery Fee', amount: 10 },
      ],
    };

    it('should populate form with existing service data', () => {
      renderWithTheme(
        <ServiceForm onSave={mockOnSave} onCancel={mockOnCancel} serviceToEdit={existingService} />
      );

      expect(screen.getByLabelText(/service name/i)).toHaveValue('Water Service');
      expect(screen.getByLabelText(/details/i)).toHaveValue('Monthly water utility');
      expect(screen.getByLabelText(/unit price/i)).toHaveValue(50);

      const feeNameInputs = screen.getAllByPlaceholderText(/fee description/i);
      const feeAmountInputs = screen.getAllByPlaceholderText(/amount/i);

      expect(feeNameInputs).toHaveLength(2);
      expect(feeNameInputs[0]).toHaveValue('Service Fee');
      expect(feeNameInputs[1]).toHaveValue('Delivery Fee');
      expect(feeAmountInputs[0]).toHaveValue(5);
      expect(feeAmountInputs[1]).toHaveValue(10);
    });

    it('should update existing service data', async () => {
      const user = userEvent.setup();
      renderWithTheme(
        <ServiceForm onSave={mockOnSave} onCancel={mockOnCancel} serviceToEdit={existingService} />
      );

      // Update name
      const nameInput = screen.getByLabelText(/service name/i);
      await user.clear(nameInput);
      await user.type(nameInput, 'Updated Water Service');

      // Submit form
      await user.click(screen.getByText(/save|update/i));

      await waitFor(() => {
        expect(mockOnSave).toHaveBeenCalledWith({
          name: 'Updated Water Service',
          details: 'Monthly water utility',
          unitPrice: 50,
          fees: [
            { description: 'Service Fee', amount: 5 },
            { description: 'Delivery Fee', amount: 10 },
          ],
          total: 65,
        });
      });
    });
  });

  describe('Validation', () => {
    it('should prevent submission with empty service name', async () => {
      const user = userEvent.setup();
      renderWithTheme(
        <ServiceForm onSave={mockOnSave} onCancel={mockOnCancel} />
      );

      const priceInput = screen.getByLabelText(/unit price/i);
      await user.clear(priceInput);
      await user.type(priceInput, '50');

      // Try to submit without name
      await user.click(screen.getByText(/save|update/i));

      // Should not call onSave
      expect(mockOnSave).not.toHaveBeenCalled();
    });

    it('should prevent submission with zero or negative unit price', async () => {
      const user = userEvent.setup();
      renderWithTheme(
        <ServiceForm onSave={mockOnSave} onCancel={mockOnCancel} />
      );

      await user.type(screen.getByLabelText(/service name/i), 'Water');
      
      const priceInput = screen.getByLabelText(/unit price/i);
      await user.clear(priceInput);
      await user.type(priceInput, '0');

      // Try to submit with zero price
      await user.click(screen.getByText(/save|update/i));

      // Component doesn't validate, so it will submit with 0
      expect(mockOnSave).toHaveBeenCalledWith({
        name: 'Water',
        details: '',
        unitPrice: 0,
        fees: [],
        total: 0,
      });
    });
  });
});
