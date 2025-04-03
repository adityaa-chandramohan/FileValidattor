// File: public/script.js - Frontend functionality
document.addEventListener('DOMContentLoaded', () => {
    const uploadForm = document.getElementById('upload-form');
    const templateSelect = document.getElementById('template');
    const resultsSection = document.getElementById('results-section');
    const totalRowsElement = document.getElementById('total-rows');
    const validRowsElement = document.getElementById('valid-rows');
    const invalidRowsElement = document.getElementById('invalid-rows');
    const errorsTableBody = document.getElementById('errors-table-body');
    const loadingOverlay = document.getElementById('loading-overlay');
    const downloadResultsBtn = document.getElementById('download-results');
    
    let validationResults = null;
  
    // Load available templates
    fetch('/api/templates')
      .then(response => response.json())
      .then(templates => {
        templates.forEach(template => {
          const option = document.createElement('option');
          option.value = template.id;
          option.textContent = template.name;
          templateSelect.appendChild(option);
        });
      })
      .catch(error => {
        console.error('Error loading templates:', error);
        alert('Failed to load validation templates. Please refresh the page and try again.');
      });
  
    // Handle form submission
    uploadForm.addEventListener('submit', async (event) => {
      event.preventDefault();
      
      const fileInput = document.getElementById('file');
      const templateId = templateSelect.value;
      
      if (!fileInput.files.length) {
        alert('Please select a file to upload');
        return;
      }
      
      if (!templateId) {
        alert('Please select a validation template');
        return;
      }
      
      const file = fileInput.files[0];
      const formData = new FormData();
      formData.append('file', file);
      formData.append('templateId', templateId);
      
      // Show loading overlay
      loadingOverlay.classList.remove('hidden');
      
      try {
        const response = await fetch('/api/validate', {
          method: 'POST',
          body: formData
        });
        
        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.error || 'Validation failed');
        }
        
        validationResults = await response.json();
        displayResults(validationResults);
      } catch (error) {
        console.error('Error during validation:', error);
        alert(`Validation error: ${error.message}`);
      } finally {
        // Hide loading overlay
        loadingOverlay.classList.add('hidden');
      }
    });
    
    // Function to display validation results
    function displayResults(results) {
      // Update summary numbers
      totalRowsElement.textContent = results.totalRows;
      validRowsElement.textContent = results.validRows;
      invalidRowsElement.textContent = results.invalidRows;
      
      // Clear previous error details
      errorsTableBody.innerHTML = '';
      
      // Add error details
      if (results.details && results.details.length > 0) {
        results.details.forEach(detail => {
          const { rowIndex, errors, rowData } = detail;
          
          Object.entries(errors).forEach(([field, errorMessage]) => {
            const row = document.createElement('tr');
            row.classList.add('error-row');
            
            const rowIndexCell = document.createElement('td');
            rowIndexCell.textContent = rowIndex;
            
            const fieldCell = document.createElement('td');
            fieldCell.textContent = field;
            
            const errorCell = document.createElement('td');
            errorCell.textContent = errorMessage;
            
            const valueCell = document.createElement('td');
            valueCell.textContent = rowData[field] !== undefined ? rowData[field] : '(empty)';
            
            row.appendChild(rowIndexCell);
            row.appendChild(fieldCell);
            row.appendChild(errorCell);
            row.appendChild(valueCell);
            
            errorsTableBody.appendChild(row);
          });
        });
      } else {
        // Show message if no errors
        const row = document.createElement('tr');
        const cell = document.createElement('td');
        cell.colSpan = 4;
        cell.textContent = 'No validation errors found';
        cell.style.textAlign = 'center';
        row.appendChild(cell);
        errorsTableBody.appendChild(row);
      }
      
      // Show results section
      resultsSection.classList.remove('hidden');
    }
    
    // Handle download results
    downloadResultsBtn.addEventListener('click', () => {
      if (!validationResults) return;
      
      // Create CSV content
      let csvContent = 'data:text/csv;charset=utf-8,Row,Field,Error,Value\n';
      
      validationResults.details.forEach(detail => {
        const { rowIndex, errors, rowData } = detail;
        
        Object.entries(errors).forEach(([field, errorMessage]) => {
          const value = rowData[field] !== undefined ? rowData[field] : '';
          // Escape CSV values properly
          const escapedValue = `"${String(value).replace(/"/g, '""')}"`;
          const escapedError = `"${errorMessage.replace(/"/g, '""')}"`;
          
          csvContent += `${rowIndex},"${field}",${escapedError},${escapedValue}\n`;
        });
      });
      
      // Create download link
      const encodedUri = encodeURI(csvContent);
      const link = document.createElement('a');
      link.setAttribute('href', encodedUri);
      link.setAttribute('download', `validation-results-${new Date().toISOString().slice(0, 10)}.csv`);
      document.body.appendChild(link);
      
      link.click();
      document.body.removeChild(link);
    });
  });