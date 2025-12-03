/**
 * Utility functions for printing records
 */

export const handlePrint = () => {
  const originalTitle = document.title;
  document.title = 'Receipt-Records';
  window.print();
  setTimeout(() => {
    document.title = originalTitle;
  }, 100);
};

export const printRecords = () => {
  handlePrint();
};
