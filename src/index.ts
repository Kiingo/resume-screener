import { OpenAI } from 'openai';
import { z } from "zod";
import { zodResponseFormat } from "openai/helpers/zod";
import Papa from 'papaparse';
import _ from 'lodash';
import * as fs from 'fs/promises';
import * as path from 'path';
import { PDFExtract, PDFExtractOptions } from 'pdf.js-extract';
import { PDFExtractResult } from 'pdf.js-extract';


interface ResumeAnalysis {
  fileName: string;
  reasoningGoodFit: string[];
  reasoningBadFit: string[];
  matchScore: number;
  keyMatches: string[];
  consMissingSkills: string[];
  recommendations: string[];
}

// Validation schemas
const JobFitSchema = z.object({
  reasoningGoodFit: z.array(z.string()),
  reasoningBadFit: z.array(z.string()),
  keyMatches: z.array(z.string()),
  consMissingSkills: z.array(z.string()),
  recommendations: z.array(z.string()),
  matchScore: z.number(),
});

const TechnicalSkillsSchema = z.object({
  programmingLanguages: z.array(z.string()),
  frameworks: z.array(z.string()),
  technicalGaps: z.array(z.string()),
  reasoningGoodFitTechnical: z.array(z.string()),
  reasoningBadFitTechnical: z.array(z.string()),
  technicalProficiencyScore: z.number(),
});

const SoftSkillsSchema = z.object({
  communicationSkills: z.array(z.string()),
  leadershipTraits: z.array(z.string()),
  teamworkIndicators: z.array(z.string()),
  reasoningGoodFitSoftSkills: z.array(z.string()),
  reasoningBadFitSoftSkills: z.array(z.string()),
  softSkillScore: z.number()
});

const ExperienceAnalysisSchema = z.object({
  yearsOfExperience: z.number(),
  relevantProjects: z.array(z.string()),
  industryExpertise: z.array(z.string()),
  reasoningGoodFitExperience: z.array(z.string()),
  reasoningBadFitExperience: z.array(z.string()),
  experienceScore: z.number()
});

// Analysis types configuration
const analysisTypes = [
  {
    type: 'technical',
    schema: TechnicalSkillsSchema,
    systemPrompt: `You are a technical recruiter specializing in evaluating technical skills. 
                Focus on concrete technical abilities, programming languages, and frameworks.
                Give a reason on why this resume's technical background is a good fit for the job description.
                Give a reason on why this resume's technical background is a bad fit for the job description.
                Then use a scale of 1-10 where 1 is lowest and 10 is highest to score the technical fit.
                Do not fabricate information from the resume.`,
    userPrompt: (text: string) => `Analyze the technical skills in this resume:\n\n${text}`
  },
  {
    type: 'soft_skills',
    schema: SoftSkillsSchema,
    systemPrompt: `You are a behavioral interview specialist focusing on soft skills and interpersonal abilities.
                Give a reason on why this resume's soft skills are a good fit for the job description.
                Give a reason on why this resume's soft skills are a bad fit for the job description.
                Then use a scale of 1-10 where 1 is lowest and 10 is highest to score the soft skills fit.
                Do not fabricate information from the resume.`,
    userPrompt: (text: string) => `Evaluate the soft skills and interpersonal abilities shown in this resume:\n\n${text}`
  },
  {
    type: 'experience',
    schema: ExperienceAnalysisSchema,
    systemPrompt: `You are an industry expert focusing on evaluating professional experience and project history.
                Give a reason on why this resume's experience is a good fit for the job description.
                Give a reason on why this resume's experience is a bad fit for the job description.
                Then use a scale of 1-10 where 1 is lowest and 10 is highest to score the experience fit.
                Do not fabricate information from the resume.`,
    userPrompt: (text: string) => `Analyze the professional experience and project history in this resume:\n\n${text}`
  }
] as const;

export class ResumeAnalyzer {
  private openai: OpenAI;
  private jobDescription: string;

  constructor(apiKey: string, jobDescription: string) {
    this.openai = new OpenAI({
      apiKey: apiKey,
      dangerouslyAllowBrowser: true
    });
    this.jobDescription = jobDescription;
  }

  public static async extractFromSinglePDF(filePath: string): Promise<{filename: string; text: string}> {
    try {
      const pdfExtract = new PDFExtract();
      const options: PDFExtractOptions = {};
      let result: PDFExtractResult;

      result = await pdfExtract.extract(filePath, options);
      let allText = '';
      for (const page of result.pages) {
        let lineHeight: number | null = null;
        let previousY: number | null = null;
        let pageText = '';
        for (const textContent of page.content) {
          let separator =
            pageText === '' ||
            textContent.str.startsWith(' ') ||
            pageText.endsWith(' ')
              ? ''
              : ' ';
          if (previousY && lineHeight) {
            if (textContent.y > previousY + lineHeight) {
              // Content is on a new line but may still be part of the same paragraph
              if (textContent.y > previousY + lineHeight * 1.5) {
                // Content is likely in a new paragraph
                separator = '\n\n';
              }
            }
          }
          pageText = `${pageText}${separator}${textContent.str}`;
          previousY = textContent.y;
          if (!lineHeight || textContent.height < lineHeight) {
            lineHeight = textContent.height;
          }
        }
        allText = `${allText}${pageText}`;
      }

      return {
        filename: path.basename(filePath),
        text: allText
      };
    } catch (err) {
      console.log(err);
      throw err;
    }
  }

  private async analyzeFit(resumeText: string): Promise<z.infer<typeof JobFitSchema>> {
    const completion = await this.openai.beta.chat.completions.parse({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content: `Analyze how well a resume matches a job description. 
                    Focus on required skills, experience, and qualifications. 
                    Based on the resume, why would this candidate be a good fit for this job description. 
                    Based on the resume, why would this candidate be a bad fit for this job description.
                    Then score from 1-10. 
                    Do not fabricate information from the resume.`
        },
        {
          role: "user",
          content: `Job Description:\n${this.jobDescription}\n\nResume:\n${resumeText}`
        }
      ],
      response_format: zodResponseFormat(JobFitSchema, 'job_fit'),
      temperature: 0.7,
    });

    if (!completion.choices[0].message.parsed) {
      throw new Error('Failed to analyze job fit');
    }

    return completion.choices[0].message.parsed;
  }

  private async analyzeResume(resumeText: string, filename: string) {
    const fitAnalysis = await this.analyzeFit(resumeText);
    const results: any = {};

    for (const analysisType of analysisTypes) {
      const completion = await this.openai.beta.chat.completions.parse({
        model: "gpt-4o-mini",
        messages: [
          {
            role: "system",
            content: analysisType.systemPrompt
          },
          {
            role: "user",
            content: analysisType.userPrompt(resumeText)
          }
        ],
        response_format: zodResponseFormat(analysisType.schema, analysisType.type),
        temperature: 0.7,
      });

      if (!completion.choices[0].message.parsed) {
        throw new Error(`Failed to parse ${analysisType.type} analysis response`);
      }

      results[analysisType.type] = completion.choices[0].message.parsed;
    }

    return {
      fileName: filename,
      matchScore: fitAnalysis.matchScore,
      keyMatches: fitAnalysis.keyMatches,
      reasoningGoodFit: fitAnalysis.reasoningGoodFit,
      reasoningBadFit: fitAnalysis.reasoningBadFit,
      consMissingSkills: fitAnalysis.consMissingSkills,
      recommendations: fitAnalysis.recommendations,
      ...this.flattenResults(results)
    };
  }

  private flattenResults(results: any) {
    const flatten = (obj: any, prefix = ''): Record<string, any> => {
      return Object.keys(obj).reduce((acc: Record<string, any>, key: string) => {
        const propName = prefix ? `${prefix}_${key}` : key;
        if (typeof obj[key] === 'object' && obj[key] !== null && !Array.isArray(obj[key])) {
          Object.assign(acc, flatten(obj[key], propName));
        } else {
          acc[propName] = Array.isArray(obj[key]) ? obj[key].join('; ') : obj[key];
        }
        return acc;
      }, {});
    };

    return _.reduce(results, (acc, value, key) => {
      const flattenedObj = flatten(value, key);
      return { ...acc, ...flattenedObj };
    }, {});
  }

  private convertToCSV(results: any[]) {
    const allKeys = ['fileName', ...new Set(
      results.flatMap(result => Object.keys(result))
    )].filter(key => key !== 'fileName');
    
    const columnOrder = ['fileName', ...allKeys.sort()];
    
    return Papa.unparse(results, {
      quotes: true,
      header: true,
      skipEmptyLines: true,
      columns: columnOrder
    });
  }

  private async saveCSV(csvContent: string, outputPath: string) {
    await fs.writeFile(outputPath, csvContent);
  }

  public async analyzeDirectory(dirPath: string, outputPath: string) {
    try {
      // Verify directory exists
      await fs.access(dirPath);
      
      // Read all files in the directory
      const files = await fs.readdir(dirPath);
      const pdfFiles = files.filter(file => path.extname(file).toLowerCase() === '.pdf');

      if (pdfFiles.length === 0) {
        console.error('No PDF files found in the specified directory');
        return;
      }

      console.log(`Found ${pdfFiles.length} PDF files. Starting analysis...`);
      const results = [];

      for (const file of pdfFiles) {
        const filePath = path.join(dirPath, file);
        console.log(`Processing ${file}...`);
        
        const extractResult = await ResumeAnalyzer.extractFromSinglePDF(filePath);
        
        const analysis = await this.analyzeResume(extractResult.text, file);
        results.push(analysis);
        console.log(`Completed analysis of ${file}`);
      }

      const csv = this.convertToCSV(results);
      await this.saveCSV(csv, outputPath);
      console.log(`Analysis complete. Results saved to ${outputPath}`);

    } catch (error) {
      console.error('Error during analysis:', error);
      throw error;
    }
  }
}