# File Validator App - Setup Instructions

## Prerequisites
- Node.js (v14 or higher)
- npm (v6 or higher)

## Installation

1. Clone the repository or create the project structure as shown:
   ```
   mkdir file-validator
   cd file-validator
   ```

2. Create all the necessary files as provided in the artifacts.

3. Create the directory structure:
   ```
   mkdir public uploads validation-templates
   ```

4. Install dependencies:
   ```
   npm install
   ```

5. Start the application:
   ```
   npm start
   ```

6. Access the application in your browser:
   ```
   http://localhost:3000
   ```

## Internal Network Access

To make the application accessible within your internal network:

1. Find your machine's local IP address:
   - On Windows: Run `ipconfig` in Command Prompt
   - On Mac/Linux: Run `ifconfig` in Terminal

2. Share this IP address with your team (e.g., `http://192.168.1.100:3000`)

## Performance Notes

This application is designed to handle large files (up to 1M records) by:

1. Using worker threads to prevent blocking the main thread
2. Processing data in chunks to manage memory usage
3. Implementing efficient validation strategies

For very large files (>500K records), consider:
- Increasing Node.js memory limit: `NODE_OPTIONS=--max-old-space-size=4096 npm start`
- Using a load balancer if multiple users need to validate files simultaneously

## Adding New Validation Templates

1. Create a new YAML file in the `validation-templates` directory following the format in the sample templates.
2. The template will automatically appear in the dropdown menu in the UI.

## Customizing Validation Rules

Each YAML template contains validation rules for specific file types. Modify them to match your requirements:

- Required fields
- String length constraints
- Date formats
- Number ranges
- Custom patterns (using regex)
- Specialized validators (email, phone, SIN, etc.)