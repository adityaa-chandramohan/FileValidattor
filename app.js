// File: app.js - Main application file
const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const yaml = require('js-yaml');
const XLSX = require('xlsx');
const csv = require('csv-parser');
const { Worker } = require('worker_threads');

const app = express();
const port = 3000;

// Configure storage for uploaded files
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadDir = path.join(__dirname, 'uploads');
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir);
    }
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    cb(null, `${Date.now()}-${file.originalname}`);
  }
});

const upload = multer({ storage });

// Serve static files from the public directory
app.use(express.static(path.join(__dirname, 'public')));
app.use(express.json());

// Routes
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Get available validation templates
app.get('/api/templates', (req, res) => {
  const templateDir = path.join(__dirname, 'validation-templates');
  fs.readdir(templateDir, (err, files) => {
    if (err) {
      return res.status(500).json({ error: 'Failed to read templates directory' });
    }
    
    const templates = files
      .filter(file => file.endsWith('.yaml'))
      .map(file => ({
        id: file.replace('.yaml', ''),
        name: file.replace('.yaml', '').split('-').map(word => 
          word.charAt(0).toUpperCase() + word.slice(1)
        ).join(' ')
      }));
    
    res.json(templates);
  });
});

// Process uploaded file
app.post('/api/validate', upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    const { templateId } = req.body;
    if (!templateId) {
      return res.status(400).json({ error: 'No template selected' });
    }

    const templatePath = path.join(__dirname, 'validation-templates', `${templateId}.yaml`);
    if (!fs.existsSync(templatePath)) {
      return res.status(404).json({ error: 'Template not found' });
    }

    // Read the validation template
    const templateContent = fs.readFileSync(templatePath, 'utf8');
    const template = yaml.load(templateContent);

    // Process the file using a worker thread for large files
    const worker = new Worker('./validator-worker.js', {
      workerData: {
        filePath: req.file.path,
        fileType: path.extname(req.file.originalname).toLowerCase(),
        template
      }
    });

    worker.on('message', (result) => {
      res.json(result);
    });

    worker.on('error', (err) => {
      console.error('Validation worker error:', err);
      res.status(500).json({ error: 'File processing failed' });
    });
  } catch (error) {
    console.error('Error during validation:', error);
    res.status(500).json({ error: 'Server error during validation' });
  }
});

// Start the server
app.listen(port, () => {
  console.log(`File validation app listening at http://localhost:${port}`);
});