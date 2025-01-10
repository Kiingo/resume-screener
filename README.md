### Resume Analyzer

# Run the project
Make sure you have Node.js and npm installed.

1. Navigate to the project directory:
Example: (C:\Users\[user]\resume-analyzer\front-end)

2. run `npm install` to install the dependencies.

3. Create a .env file in the root directory and add the following variables:
REACT_APP_OPENAI_API_KEY='[API KEY GOES HERE]'

'Usage: npm start -- <directory_path> <output_path> <job_description> <openai_api_key>'
'Example: npm start -- ./resumes ./output.csv "Software Engineer" sk-your-api-key'