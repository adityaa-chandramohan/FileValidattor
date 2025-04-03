// File: validator-worker.js - Worker thread for processing large files
const { workerData, parentPort } = require('worker_threads');
const XLSX = require('xlsx');
const fs = require('fs');
const { createReadStream } = require('fs');
const csv = require('csv-parser');

const { filePath, fileType, template } = workerData;

// Validator functions
const validators = {
  // String validators
  string: (value, rule) => {
    if (rule.maxLength && value.length > rule.maxLength) {
      return `Exceeds maximum length of ${rule.maxLength}`;
    }
    if (rule.minLength && value.length < rule.minLength) {
      return `Below minimum length of ${rule.minLength}`;
    }
    if (rule.pattern) {
      const regex = new RegExp(rule.pattern);
      if (!regex.test(value)) {
        return `Does not match required pattern`;
      }
    }
    return null;
  },
  
  // Date validators
  date: (value, rule) => {
    const date = new Date(value);
    if (isNaN(date.getTime())) {
      return 'Invalid date format';
    }
    
    if (rule.format) {
      // Check specific date format if required
      // This is a simple implementation; a more robust solution might use a library like moment.js
      const formatRegexMap = {
        'YYYY-MM-DD': /^\d{4}-\d{2}-\d{2}$/,
        'MM/DD/YYYY': /^\d{2}\/\d{2}\/\d{4}$/,
        // Add more formats as needed
      };
      
      if (formatRegexMap[rule.format] && !formatRegexMap[rule.format].test(value)) {
        return `Date must be in ${rule.format} format`;
      }
    }
    
    return null;
  },
  
  // Number validators
  number: (value, rule) => {
    const num = Number(value);
    if (isNaN(num)) {
      return 'Not a valid number';
    }
    
    if (rule.min !== undefined && num < rule.min) {
      return `Below minimum value of ${rule.min}`;
    }
    
    if (rule.max !== undefined && num > rule.max) {
      return `Exceeds maximum value of ${rule.max}`;
    }
    
    return null;
  },
  
  // SIN (Social Insurance Number) validator - Canadian example
  sin: (value) => {
    // Remove any spaces or dashes
    const cleanValue = value.replace(/[\s-]/g, '');
    
    // Check if it's 9 digits
    if (!/^\d{9}$/.test(cleanValue)) {
      return 'SIN must be 9 digits';
    }
    
    // Luhn algorithm validation (common for IDs like SIN)
    let sum = 0;
    let alternate = false;
    
    for (let i = cleanValue.length - 1; i >= 0; i--) {
      let n = parseInt(cleanValue.charAt(i), 10);
      
      if (alternate) {
        n *= 2;
        if (n > 9) {
          n = (n % 10) + 1;
        }
      }
      
      sum += n;
      alternate = !alternate;
    }
    
    if (sum % 10 !== 0) {
      return 'Invalid SIN checksum';
    }
    
    return null;
  },
  
  // Email validator
  email: (value) => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(value)) {
      return 'Invalid email format';
    }
    return null;
  },
  
  // Phone number validator
  phone: (value) => {
    // Simple phone format check - can be enhanced for specific formats
    const cleanValue = value.replace(/[\s()-]/g, '');
    if (!/^\+?\d{10,15}$/.test(cleanValue)) {
      return 'Invalid phone number format';
    }
    return null;
  }
};

// Function to validate a row against the template
function validateRow(row, template) {
  const errors = {};
  let hasErrors = false;
  
  Object.keys(template.columns).forEach(columnKey => {
    const columnDef = template.columns[columnKey];
    const value = row[columnKey] !== undefined ? String(row[columnKey]) : '';
    
    // Skip validation if value is empty and not required
    if (!value && !columnDef.required) {
      return;
    }
    
    // Check if required field is missing
    if (columnDef.required && !value) {
      errors[columnKey] = 'Required field is missing';
      hasErrors = true;
      return;
    }
    
    // Apply validation based on type
    if (value && columnDef.type && validators[columnDef.type]) {
      const error = validators[columnDef.type](value, columnDef);
      if (error) {
        errors[columnKey] = error;
        hasErrors = true;
      }
    }
  });
  
  return { isValid: !hasErrors, errors };
}

// Process Excel file
async function processExcel(filePath, template) {
  const workbook = XLSX.readFile(filePath);
  const sheetName = workbook.SheetNames[0];
  const worksheet = workbook.Sheets[sheetName];
  const rows = XLSX.utils.sheet_to_json(worksheet, { defval: '' });
  
  return processRows(rows, template);
}

// Process CSV file
async function processCsv(filePath, template) {
  return new Promise((resolve) => {
    const rows = [];
    
    createReadStream(filePath)
      .pipe(csv())
      .on('data', (row) => rows.push(row))
      .on('end', () => {
        resolve(processRows(rows, template));
      });
  });
}

// Process the rows and validate them
function processRows(rows, template) {
  const results = {
    totalRows: rows.length,
    validRows: 0,
    invalidRows: 0,
    details: []
  };
  
  // Process in chunks to avoid blocking
  const chunkSize = 1000;
  let processedRows = 0;
  
  while (processedRows < rows.length) {
    const chunk = rows.slice(processedRows, processedRows + chunkSize);
    
    for (const row of chunk) {
      const rowIndex = processedRows + 1; // 1-based index for user display
      const validation = validateRow(row, template);
      
      if (validation.isValid) {
        results.validRows++;
      } else {
        results.invalidRows++;
        results.details.push({
          rowIndex,
          errors: validation.errors,
          rowData: row
        });
      }
      
      processedRows++;
    }
  }
  
  return results;
}

// Main processing function
async function processFile() {
  try {
    let results;
    
    if (fileType === '.xlsx' || fileType === '.xls') {
      results = await processExcel(filePath, template);
    } else if (fileType === '.csv') {
      results = await processCsv(filePath, template);
    } else {
      throw new Error('Unsupported file type');
    }
    
    // Clean up the uploaded file
    fs.unlinkSync(filePath);
    
    // Send results back to main thread
    parentPort.postMessage(results);
  } catch (error) {
    console.error('Error processing file:', error);
    parentPort.postMessage({ error: error.message });
  }
}

// Start processing
processFile();