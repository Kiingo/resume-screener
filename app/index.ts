import { ResumeAnalyzer } from '../src/index';

// (async () => {
//   console.log('Hello World');
//   // const jobDescriptionFilePath = 'C:\\Users\\matth\\Desktop\\Cursor\\projects\\typescript-boilerplate\\src\\pdf-files\\Resume 2020.pdf';
//   // const jobDescriptionExtractionResults = await ResumeAnalyzer.extractFromSinglePDF(jobDescriptionFilePath);
//   // const jobDescription = jobDescriptionExtractionResults.text;
  
//   // const apiKey = '';
//   // const resumeAnalyzer = new ResumeAnalyzer(apiKey, jobDescription);
//   const resumeAnalyzer = new ResumeAnalyzer('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', 'Software');
//   resumeAnalyzer.analyzeDirectory('C:\\Users\\matth\\Desktop\\Cursor\\projects\\typescript-boilerplate\\src\\pdf-files', 'C:\\Users\\matth\\Desktop\\Cursor\\projects\\typescript-boilerplate\\src\\output.csv');
// })();
main();

async function main() {
  // Get arguments, skipping the first two (node and script path)
  const args = process.argv.slice(2);
  
  if (args.length < 4) {
      console.log('Usage: npm start -- <directory_path> <output_path> <job_description> <openai_api_key>');
      console.log('Example: npm start -- ./resumes ./output.csv "Software Engineer" sk-your-api-key');
      process.exit(1);
  }

  const [dirPath, outputPath, jobDescription, apiKey] = args;

  try {
      const analyzer = new ResumeAnalyzer(apiKey, jobDescription);
      await analyzer.analyzeDirectory(dirPath, outputPath);
  } catch (error) {
      console.error('Error:', error);
      process.exit(1);
  }
}