import { ResumeAnalyzer } from '../src/index';
import * as fs from 'fs/promises';
import * as dotenv from 'dotenv';

dotenv.config();
main();

async function readTextFile(filePath: string): Promise<string> {
    try {
        const text = await fs.readFile(filePath, 'utf8');
        return text;
    } catch (error) {
        throw new Error(`Error reading file: ${error}`);
    }
}

async function main() {
  // Get arguments, skipping the first two (node and script path)
  const args = process.argv.slice(2);
  
  if (args.length < 3) {
      console.log('Usage: npm start -- <directory_path> <output_path> <job_description> <openai_api_key>');
      console.log('Example: npm start -- ./resumes ./output.csv "Software Engineer" sk-your-api-key');
      process.exit(1);
  }

  const [dirPath, outputPath, jobDescriptionPath] = args;
  const jobDescription = await readTextFile(jobDescriptionPath);
  const apiKey = process.env.REACT_APP_OPENAI_API_KEY;
  if (!apiKey) {
    console.error('REACT_APP_OPENAI_API_KEY is not set in the environment variables');
    process.exit(1);
  }

  try {
      const analyzer = new ResumeAnalyzer(apiKey, jobDescription);
      await analyzer.analyzeDirectory(dirPath, outputPath);
  } catch (error) {
      console.error('Error:', error);
      process.exit(1);
  }
}