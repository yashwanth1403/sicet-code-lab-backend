import express, { Request, Response, NextFunction } from "express";
import cors from "cors";
import dotenv from "dotenv";
import axios from "axios";
import { AxiosError } from "axios";
import jwt from "jsonwebtoken";
import { LANGUAGE_IDS } from "./constants/judge0";
import { STATUS_CODES } from "./constants/judge0";
import { Status } from "./constants/judge0";
import prisma from "./lib/db";
import { TestCases } from "@prisma/client";

// Authentication interfaces
interface AuthUser {
  id: string;
  collegeId: string;
  contact: string;
  role: "student" | "admin";
  batch?: string;
  department?: string;
  name?: string;
  email?: string;
}

interface AuthenticatedRequest extends Request {
  user?: AuthUser;
}

// TypeScript interfaces
interface JudgeSubmissionResult {
  status: {
    id: number;
    description: string;
  };
  stdout: string | null;
  stderr: string | null;
  compile_output: string | null;
  message: string | null;
  time: string;
  memory: number;
  // Add decoded properties that we add to the result
  decoded_stdout?: string;
  decoded_stderr?: string;
  decoded_compile_output?: string;
  decoded_message?: string;
}

// Define result types for clarity
interface CodeExecutionResult {
  status: "success" | "error";
  statusDescription: string;
  dbStatus: string;
  output: string | null;
  error: string | null;
  executionTime: number | null;
  memory: number | null;
}

interface TestCaseResult {
  input: string;
  expectedOutput: string;
  actualOutput: string | null;
  error: string | null;
  passed: boolean;
  statusDescription: string;
  executionTime: number | null;
  memory: number | null;
  isHidden?: boolean; // Flag to indicate if test case is hidden
}

interface TestCasesResult {
  passed: number;
  total: number;
  cases: TestCaseResult[];
  status: string;
  hiddenTestsCount?: number; // Count of hidden tests
  allTestsPassed?: number; // Total tests passed including hidden
  allTestsTotal?: number; // Total tests including hidden
}

interface SubmissionActionResult {
  success: boolean;
  data?: unknown;
  error?: string;
}

// Load environment variables
dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;
const JWT_SECRET = process.env.JWT_SECRET || "your-secret-key";
const JUDGE0_API_URL = process.env.JUDGE0_API_URL;

// Configuration constants
const TEST_CASE_TIMEOUT_MS = 6000; // 6 seconds timeout for each test case
const MAX_POLLING_ATTEMPTS = 6; // Maximum polling attempts (1 second intervals)

// Middleware
app.use(
  cors({
    origin: process.env.FRONTEND_URL || "http://localhost:3000",
    credentials: true, // Allow cookies to be sent
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
  })
);
app.use(express.json());

// Authentication middleware
const authenticateToken = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const authHeader = req.headers.authorization;
    const token = authHeader && authHeader.split(" ")[1]; // Bearer TOKEN

    if (!token) {
      res.status(401).json({
        error: "Access denied. No token provided.",
        message:
          "Please provide a valid authentication token in the Authorization header.",
      });
      return;
    }

    // Verify JWT token
    const decoded = jwt.verify(token, JWT_SECRET) as any;

    // Extract user information from the token
    const user: AuthUser = {
      id: decoded.id || decoded.sub,
      collegeId: decoded.collegeId,
      contact: decoded.contact,
      role: decoded.role,
      batch: decoded.batch,
      department: decoded.department,
      name: decoded.name,
      email: decoded.email,
    };

    req.user = user;
    next();
  } catch (error) {
    console.error("Token verification failed:", error);

    if (error instanceof jwt.JsonWebTokenError) {
      res.status(403).json({
        error: "Invalid token",
        message: "The provided token is invalid or malformed.",
      });
    } else if (error instanceof jwt.TokenExpiredError) {
      res.status(403).json({
        error: "Token expired",
        message: "The provided token has expired. Please log in again.",
      });
    } else {
      res.status(500).json({
        error: "Token verification failed",
        message: "An error occurred while verifying the token.",
      });
    }
  }
};

export async function createSubmission(
  code: string,
  languageName: string,
  input?: string,
  expectedOutput?: string
): Promise<string> {
  try {
    const languageId = LANGUAGE_IDS[languageName as keyof typeof LANGUAGE_IDS];
    if (!languageId) {
      throw new Error(`Unsupported language: ${languageName}`);
    }

    console.log("Code:", code);
    console.log("Original input:", input);

    // Check if code start
    // s with a caret and remove it if needed
    const cleanedCode = code.startsWith("^") ? code.substring(1) : code;

    // Process input - handle special cases
    let processedInput = null;
    if (input) {
      // Check if this is a string with quotes that needs to preserve spaces
      if (input.trim().startsWith('"') && input.trim().endsWith('"')) {
        // This is likely a string that needs to preserve spaces
        // Remove only outer quotes and escaped quotes, keep internal spaces
        processedInput = input.trim();

        // Remove outer quotes if they exist
        if (processedInput.startsWith('"') && processedInput.endsWith('"')) {
          processedInput = processedInput.slice(1, -1);
        }

        // Remove escaped quotes
        processedInput = processedInput.replace(/\\"/g, "");

        console.log(
          "Processed string input (spaces preserved):",
          processedInput
        );
      } else {
        // For non-string inputs, we can still remove whitespace
        processedInput = input.replace(/\s+/g, "");
        console.log(
          "Processed numeric input (whitespace removed):",
          processedInput
        );
      }
    }

    // Create submission data exactly matching the format from the sample
    const submissionData = JSON.stringify({
      source_code: cleanedCode,
      language_id: languageId.toString(),
      number_of_runs: null,
      stdin: processedInput,
      expected_output: expectedOutput || null,
      cpu_time_limit: null,
      cpu_extra_time: null,
      wall_time_limit: null,
      memory_limit: null,
      stack_limit: null,
      max_processes_and_or_threads: null,
      enable_per_process_and_thread_time_limit: null,
      enable_per_process_and_thread_memory_limit: null,
      max_file_size: null,
      enable_network: null,
    });

    // Axios configuration matching the sample exactly
    const config = {
      method: "post",
      maxBodyLength: Infinity,
      url: JUDGE0_API_URL,
      headers: {
        Accept: "*/*",
        "Accept-Language": "en-US,en;q=0.9",
        Connection: "keep-alive",
        "Content-Type": "application/json",
        Origin: "http://64.227.187.93:2358",
        Referer: "http://64.227.187.93:2358/dummy-client.html",
        "User-Agent":
          "Mozilla/5.0 (Linux; Android 6.0; Nexus 5 Build/MRA58N) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/134.0.0.0 Mobile Safari/537.36",
        "X-Requested-With": "XMLHttpRequest",
      },
      data: submissionData,
    };

    console.log("Request config:", config);

    const response = await axios(config);
    console.log("Response data:", response.data);

    return response.data.token;
  } catch (error: unknown) {
    console.error("Error creating submission:", error);
    // Print out more detailed error information
    if (error instanceof AxiosError && error.response) {
      console.error("Response status:", error.response.status);
      console.error("Response data:", error.response.data);
      console.error("Response headers:", error.response.headers);
    }
    throw error;
  }
}

export async function getSubmissionResult(
  token: string
): Promise<JudgeSubmissionResult> {
  try {
    if (!token) throw new Error("Invalid submission token.");
    console.log("Fetching result for token:", token);

    // Fix: Ensure we don't duplicate "submissions" in the URL
    const url = `${JUDGE0_API_URL}/${token}?base64_encoded=true`;

    const config = {
      method: "get",
      maxBodyLength: Infinity,
      url,
      headers: {
        Accept: "*/*",
        "Accept-Language": "en-US,en;q=0.9",
        Connection: "keep-alive",
        Referer: "http://64.227.187.93:2358/dummy-client.html",
        "User-Agent":
          "Mozilla/5.0 (Linux; Android 6.0; Nexus 5 Build/MRA58N) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/134.0.0.0 Mobile Safari/537.36",
        "X-Requested-With": "XMLHttpRequest",
      },
    };

    console.log("Get result config:", config);
    const response = await axios.request(config);
    console.log("Get result response:", response.data);

    // Decode base64 fields if they exist
    const decodedResult = { ...response.data };

    if (decodedResult.stdout && decodedResult.stdout.trim()) {
      decodedResult.decoded_stdout = Buffer.from(
        decodedResult.stdout,
        "base64"
      ).toString("utf-8");
    }

    if (decodedResult.stderr && decodedResult.stderr.trim()) {
      decodedResult.decoded_stderr = Buffer.from(
        decodedResult.stderr,
        "base64"
      ).toString("utf-8");
    }

    if (decodedResult.compile_output && decodedResult.compile_output.trim()) {
      decodedResult.decoded_compile_output = Buffer.from(
        decodedResult.compile_output,
        "base64"
      ).toString("utf-8");
    }

    if (decodedResult.message && decodedResult.message.trim()) {
      decodedResult.decoded_message = Buffer.from(
        decodedResult.message,
        "base64"
      ).toString("utf-8");
    }
    console.log("Decoded result:", decodedResult);

    return decodedResult;
  } catch (error: unknown) {
    console.error("Error getting submission result:", error);
    // Add more detailed error logging
    if (error instanceof AxiosError && error.response) {
      console.error("Response status:", error.response.status);
      console.error("Response data:", error.response.data);
      console.error("Response headers:", error.response.headers);
    }
    throw error;
  }
}

export async function runCode(
  code: string,
  languageName: string,
  input?: string
): Promise<CodeExecutionResult> {
  try {
    const token = await createSubmission(code, languageName, input);

    // Poll for results
    let result: JudgeSubmissionResult | null = null;
    let attempts = 0;
    const maxAttempts = 10; // Maximum polling attempts
    console.log("token", token);

    while (!result && attempts < maxAttempts) {
      await new Promise((resolve) => setTimeout(resolve, 1000)); // Wait 1 second

      const submissionResult = await getSubmissionResult(token);

      // Check if processing is complete
      if (submissionResult.status.id >= 3) {
        result = submissionResult;
      }

      attempts++;
    }

    if (!result) {
      throw new Error("Execution timed out");
    }

    // Map Judge0 status to database status
    const status = mapJudgeStatusToDbStatus(result.status.id);

    // Decode outputs if they exist and are base64 encoded
    let decodedStdout = null;
    let decodedStderr = null;
    let decodedCompileOutput = null;

    if (result.stdout && result.stdout.trim()) {
      decodedStdout = Buffer.from(result.stdout, "base64").toString("utf-8");
    }

    if (result.stderr && result.stderr.trim()) {
      decodedStderr = Buffer.from(result.stderr, "base64").toString("utf-8");
    }

    if (result.compile_output && result.compile_output.trim()) {
      decodedCompileOutput = Buffer.from(
        result.compile_output,
        "base64"
      ).toString("utf-8");
    }

    // Format the response
    return {
      status: result.status.id === 3 ? "success" : "error",
      statusDescription:
        STATUS_CODES[result.status.id as keyof typeof STATUS_CODES] ||
        "Unknown",
      dbStatus: status,
      output: decodedCompileOutput || decodedStdout || null,
      error: decodedStderr || decodedCompileOutput || null,
      executionTime: parseFloat(result.time),
      memory: result.memory,
    };
  } catch (error: unknown) {
    console.error("Error running code:", error);
    return {
      status: "error",
      statusDescription: "Execution Error",
      dbStatus: Status.ERROR,
      output: null,
      error:
        error instanceof Error
          ? error.message
          : "An error occurred during execution",
      executionTime: null,
      memory: null,
    };
  }
}

// Map Judge0 status to our database Status enum
const mapJudgeStatusToDbStatus = (judgeStatusId: number): string => {
  switch (judgeStatusId) {
    case 1: // In Queue
    case 2: // Processing
      return Status.RUNNING;
    case 3: // Accepted
      return Status.COMPLETED;
    case 4: // Wrong Answer
      return Status.FAILED;
    case 5: // Time Limit Exceeded
    case 6: // Compilation Error
    case 7: // Runtime Error (SIGSEGV)
    case 8: // Runtime Error (SIGXFSZ)
    case 9: // Runtime Error (SIGFPE)
    case 10: // Runtime Error (SIGABRT)
    case 11: // Runtime Error (NZEC)
    case 12: // Runtime Error (Other)
      return Status.ERROR;
    case 13: // Internal Error
    case 14: // Exec Format Error
    default:
      return Status.ERROR;
  }
};

// Run test cases and check against expected output
export async function runTestCases(
  code: string,
  languageName: string,
  testCases: TestCases[],
  includeHidden: boolean = false // New parameter to control hidden test case inclusion
): Promise<TestCasesResult> {
  console.log("testCases", testCases.length, "includeHidden:", includeHidden);
  try {
    // Run each test case
    const results = await Promise.all(
      testCases.map(async (testCase) => {
        const token = await createSubmission(
          code,
          languageName,
          testCase.input,
          testCase.output
        );

        // Poll for results with configurable timeout
        let attempts = 0;
        const maxAttempts = MAX_POLLING_ATTEMPTS;
        const startTime = Date.now();
        const timeoutMs = TEST_CASE_TIMEOUT_MS;

        while (attempts < maxAttempts) {
          // Check if we've exceeded the timeout
          if (Date.now() - startTime > timeoutMs) {
            console.log(`Test case timed out after ${timeoutMs}ms`);
            return {
              input: testCase.input,
              expectedOutput: testCase.output,
              actualOutput: null,
              error: `Test case execution timed out (${
                timeoutMs / 1000
              }s limit exceeded)`,
              passed: false,
              statusDescription: "Time Limit Exceeded",
              executionTime: timeoutMs / 1000, // Convert to seconds
              memory: null,
              isHidden: testCase.isHidden || false,
            };
          }

          await new Promise((resolve) => setTimeout(resolve, 1000));

          try {
            const result = await getSubmissionResult(token);

            // Check if processing is complete
            if (result.status.id >= 3) {
              const passed = result.status.id === 3;

              // Decode outputs if they exist and are base64 encoded
              let decodedStdout = null;
              let decodedStderr = null;
              let decodedCompileOutput = null;

              if (result.stdout && result.stdout.trim()) {
                decodedStdout = Buffer.from(result.stdout, "base64").toString(
                  "utf-8"
                );
              }

              if (result.stderr && result.stderr.trim()) {
                decodedStderr = Buffer.from(result.stderr, "base64").toString(
                  "utf-8"
                );
              }

              if (result.compile_output && result.compile_output.trim()) {
                decodedCompileOutput = Buffer.from(
                  result.compile_output,
                  "base64"
                ).toString("utf-8");
              }

              // Check if this is a timeout from Judge0 (status 5 = Time Limit Exceeded)
              if (result.status.id === 5) {
                return {
                  input: testCase.input,
                  expectedOutput: testCase.output,
                  actualOutput: decodedStdout || null,
                  error: decodedStderr || "Time limit exceeded",
                  passed: false,
                  statusDescription: "Time Limit Exceeded",
                  executionTime: parseFloat(result.time) || timeoutMs / 1000, // Use actual time or max
                  memory: result.memory,
                  isHidden: testCase.isHidden || false,
                };
              }

              return {
                input: testCase.input,
                expectedOutput: testCase.output,
                actualOutput: decodedStdout || null,
                error: decodedStderr || decodedCompileOutput || null,
                passed,
                statusDescription:
                  STATUS_CODES[result.status.id as keyof typeof STATUS_CODES] ||
                  "Unknown",
                executionTime: parseFloat(result.time),
                memory: result.memory,
                isHidden: testCase.isHidden || false, // Include hidden flag
              };
            }
          } catch (pollError) {
            console.error(`Error polling submission result: ${pollError}`);
            // Continue polling unless we've hit the timeout
          }

          attempts++;
        }

        // If we reach here, we've exceeded our polling attempts
        return {
          input: testCase.input,
          expectedOutput: testCase.output,
          actualOutput: null,
          error: `Test case execution timed out (${
            timeoutMs / 1000
          }s limit exceeded)`,
          passed: false,
          statusDescription: "Time Limit Exceeded",
          executionTime: timeoutMs / 1000, // Max timeout in seconds
          memory: null,
          isHidden: testCase.isHidden || false, // Include hidden flag
        };
      })
    );

    // Calculate summary and determine overall status (based on ALL test cases)
    const passed = results.filter((r) => r.passed).length;
    const totalTests = testCases.length;
    const timedOut = results.filter(
      (r) => r.statusDescription === "Time Limit Exceeded"
    ).length;

    // Log timeout summary if any test cases timed out
    if (timedOut > 0) {
      console.log(
        `${timedOut} out of ${totalTests} test cases timed out (>${
          TEST_CASE_TIMEOUT_MS / 1000
        }s)`
      );
    }

    // If all tests pass, status is COMPLETED
    // If some pass, status is FAILED
    // If none pass, status is ERROR
    let overallStatus: string;
    if (passed === totalTests) {
      overallStatus = Status.COMPLETED;
    } else if (passed > 0) {
      overallStatus = Status.FAILED;
    } else {
      overallStatus = Status.ERROR;
    }

    // Filter results based on includeHidden parameter
    const filteredResults = includeHidden
      ? results
      : results.filter((r) => !r.isHidden);

    // Calculate visible test case statistics for the response
    const visibleResults = results.filter((r) => !r.isHidden);
    const visiblePassed = visibleResults.filter((r) => r.passed).length;

    return {
      passed: visiblePassed, // Only count visible passed tests in response
      total: visibleResults.length, // Only count visible tests in response
      cases: filteredResults, // Return filtered results
      status: overallStatus, // Status is still based on ALL tests
      hiddenTestsCount: results.filter((r) => r.isHidden).length, // Add count of hidden tests
      allTestsPassed: passed, // Total tests passed (including hidden)
      allTestsTotal: totalTests, // Total tests (including hidden)
    };
  } catch (error: unknown) {
    console.error("Error running test cases:", error);

    // Filter test cases for error response too
    const visibleTestCases = includeHidden
      ? testCases
      : testCases.filter((tc) => !tc.isHidden);

    return {
      passed: 0,
      total: visibleTestCases.length,
      cases: visibleTestCases.map((tc) => ({
        input: tc.input,
        expectedOutput: tc.output,
        actualOutput: null,
        error:
          error instanceof Error
            ? error.message
            : "An error occurred while running tests",
        passed: false,
        statusDescription: "Error",
        executionTime: null,
        memory: null,
        isHidden: tc.isHidden || false,
      })),
      status: Status.ERROR,
      hiddenTestsCount: testCases.filter((tc) => tc.isHidden).length,
      allTestsPassed: 0,
      allTestsTotal: testCases.length,
    };
  }
}

// Server action to save submission (simplified example)
export async function saveSubmissionAction(
  data: unknown
): Promise<SubmissionActionResult> {
  try {
    // This would typically call your database service
    // Mocking it here for simplicity
    console.log("Saving submission to database:", data);

    return { success: true, data };
  } catch (error: unknown) {
    console.error("Error saving submission:", error);
    return {
      success: false,
      error:
        error instanceof Error ? error.message : "An unknown error occurred",
    };
  }
}

// API Routes

// Basic route - Run code with input (Protected)
app.post(
  "/runcode",
  authenticateToken,
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { code, language, input } = req.body;

      if (!code || !language) {
        return res.status(400).json({
          error: "Missing required fields: code and language are required",
        });
      }

      console.log(
        `User ${req.user?.collegeId} (${req.user?.role}) is running code`
      );
      const response = await runCode(code, language, input);
      res.json(response);
    } catch (error) {
      console.error("Error in /runcode:", error);
      res.status(500).json({
        error: "Internal server error",
        message: error instanceof Error ? error.message : "Unknown error",
      });
    }
  }
);

// Create a submission (Protected)
app.post(
  "/submissions",
  authenticateToken,
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { code, language, input, expectedOutput } = req.body;

      if (!code || !language) {
        return res.status(400).json({
          error: "Missing required fields: code and language are required",
        });
      }

      console.log(
        `User ${req.user?.collegeId} (${req.user?.role}) is creating a submission`
      );
      const token = await createSubmission(
        code,
        language,
        input,
        expectedOutput
      );
      res.json({
        token,
        message: "Submission created successfully",
        userId: req.user?.id,
        userRole: req.user?.role,
      });
    } catch (error) {
      console.error("Error in /submissions:", error);
      res.status(500).json({
        error: "Failed to create submission",
        message: error instanceof Error ? error.message : "Unknown error",
      });
    }
  }
);

// Get submission result by token (Protected)
app.get(
  "/submissions/:token",
  authenticateToken,
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { token } = req.params;

      if (!token) {
        return res.status(400).json({
          error: "Missing required parameter: token",
        });
      }

      console.log(
        `User ${req.user?.collegeId} (${req.user?.role}) is fetching submission result`
      );
      const result = await getSubmissionResult(token);
      res.json(result);
    } catch (error) {
      console.error("Error in /submissions/:token:", error);
      res.status(500).json({
        error: "Failed to get submission result",
        message: error instanceof Error ? error.message : "Unknown error",
      });
    }
  }
);

// Run test cases (Protected)
app.post(
  "/testcases",
  authenticateToken,
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { code, language, problemId } = req.body;

      if (!code || !language || !problemId) {
        return res.status(400).json({
          error:
            "Missing required fields: code, language, and testCases (array) are required",
        });
      }
      const testCases = await prisma.testCases.findMany({
        where: {
          problemId,
        },
      });
      console.log("testCases", testCases[0].input);

      // Validate test cases format
      const invalidTestCase = testCases.find(
        (tc) => !tc.hasOwnProperty("input") || !tc.hasOwnProperty("output")
      );

      if (invalidTestCase) {
        return res.status(400).json({
          error:
            "Invalid test case format: each test case must have 'input' and 'output' properties",
        });
      }

      console.log(
        `User ${req.user?.collegeId} (${req.user?.role}) is running test cases`
      );

      // For regular test runs, don't include hidden test cases in response
      // Hidden tests are still executed for grading but not shown to students
      const result = await runTestCases(code, language, testCases, false);
      res.json({
        ...result,
        userId: req.user?.id,
        userRole: req.user?.role,
      });
    } catch (error) {
      console.error("Error in /testcases:", error);
      res.status(500).json({
        error: "Failed to run test cases",
        message: error instanceof Error ? error.message : "Unknown error",
      });
    }
  }
);

// Atomic submit and test endpoint - runs tests and saves submission in one operation
app.post(
  "/submissions/submit-and-test",
  authenticateToken,
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { code, language, problemId, assessmentId, studentId } = req.body;

      // Validate required fields
      if (!code || !language || !problemId || !assessmentId) {
        return res.status(400).json({
          error: "Missing required fields",
          details: "code, language, problemId, and assessmentId are required",
        });
      }

      // Use studentId from request body or fall back to authenticated user
      const finalStudentId = studentId || req.user?.id;

      if (!finalStudentId) {
        return res.status(400).json({
          error: "Student ID is required",
          details: "Either provide studentId or ensure user is authenticated",
        });
      }

      console.log(
        `User ${req.user?.collegeId} (ID: ${finalStudentId}) is submitting code for problem ${problemId}`
      );

      // Get test cases for this problem
      const testCases = await prisma.testCases.findMany({
        where: { problemId },
      });

      if (testCases.length === 0) {
        return res.status(404).json({
          error: "No test cases found for this problem",
          details: `Problem ${problemId} has no test cases configured`,
        });
      }

      // Run ALL test cases (including hidden ones) - this cannot be manipulated by frontend
      console.log(
        `Running ${
          testCases.length
        } test cases for problem ${problemId} (timeout: ${
          TEST_CASE_TIMEOUT_MS / 1000
        }s per test)`
      );
      const testResult = await runTestCases(code, language, testCases, true);

      // Calculate final status and score based on ALL tests (including hidden)
      const totalPassed = testResult.allTestsPassed || testResult.passed;
      const totalTests = testResult.allTestsTotal || testResult.total;

      let finalStatus: string;
      if (totalPassed === totalTests) {
        finalStatus = "COMPLETED";
      } else if (totalPassed > 0) {
        finalStatus = "FAILED";
      } else {
        finalStatus = "ERROR";
      }

      // Calculate score based on ALL tests (including hidden)
      const problem = await prisma.problems.findUnique({
        where: { id: problemId },
        select: { score: true },
      });

      let finalScore: number;
      if (problem?.score) {
        finalScore = Math.round((totalPassed / totalTests) * problem.score);
      } else {
        finalScore = totalPassed === totalTests ? 100 : 0;
      }

      // Calculate execution stats
      const execTimes = testResult.cases
        .map((c) => c.executionTime)
        .filter((time): time is number => typeof time === "number");
      const avgExecTime = execTimes.length
        ? execTimes.reduce((a, b) => a + b, 0) / execTimes.length
        : null;

      const memories = testResult.cases
        .map((c) => c.memory)
        .filter((mem): mem is number => typeof mem === "number");
      const avgMemory = memories.length
        ? memories.reduce((a, b) => a + b, 0) / memories.length
        : null;

      const errorMessage = testResult.cases.find((c) => c.error)?.error || null;

      // Save submission to database (upsert to handle unique constraint)
      const submission = await prisma.submission.upsert({
        where: {
          studentId_problemId: {
            studentId: finalStudentId,
            problemId: problemId,
          },
        },
        update: {
          code,
          language,
          status: finalStatus as any,
          score: finalScore,
          executionTime: avgExecTime
            ? parseFloat(avgExecTime.toString())
            : null,
          memoryUsed: avgMemory ? parseInt(avgMemory.toString()) : null,
          errorMessage: errorMessage || null,
          testResults: JSON.stringify({
            ...testResult,
            cases: testResult.cases.filter((c: TestCaseResult) => !c.isHidden), // Store only visible test cases
          }),
          isSubmitted: true,
        },
        create: {
          code,
          language,
          status: finalStatus as any,
          score: finalScore,
          studentId: finalStudentId,
          problemId,
          executionTime: avgExecTime
            ? parseFloat(avgExecTime.toString())
            : null,
          memoryUsed: avgMemory ? parseInt(avgMemory.toString()) : null,
          errorMessage: errorMessage || null,
          testResults: JSON.stringify({
            ...testResult,
            cases: testResult.cases.filter((c: TestCaseResult) => !c.isHidden), // Store only visible test cases
          }),
          isSubmitted: true,
        },
      });

      console.log(
        `Submission saved with ID: ${submission.id}, Score: ${finalScore}/${
          problem?.score || 100
        }`
      );

      // Return the submission result with filtered test cases (no hidden test details)
      res.status(201).json({
        success: true,
        message: "Code submitted and tested successfully",
        isUpdate: submission.createdAt.getTime() !== new Date().getTime(),
        data: {
          id: submission.id,
          code: submission.code,
          language: submission.language,
          status: submission.status,
          score: submission.score,
          studentId: submission.studentId,
          problemId: submission.problemId,
          createdAt: submission.createdAt,
          executionTime: submission.executionTime,
          memoryUsed: submission.memoryUsed,
          errorMessage: submission.errorMessage,
          // Return filtered test results (no hidden test case details)
          testResults: {
            ...testResult,
            cases: testResult.cases.filter((c: TestCaseResult) => !c.isHidden),
          },
        },
        submittedBy: req.user?.collegeId,
      });
    } catch (error) {
      console.error("Error in /submissions/submit-and-test:", error);
      res.status(500).json({
        success: false,
        error: "Internal server error",
        message: error instanceof Error ? error.message : "Unknown error",
      });
    }
  }
);

// Save coding submission (Protected - Students and Admins) - Legacy endpoint
app.post(
  "/submissions/coding",
  authenticateToken,
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const {
        code,
        language,
        problemId,
        assessmentId,
        studentId,
        executionTime,
        memoryUsed,
        errorMessage,
        testResults,
        questionNumber,
        questionPreview,
        status,
        score,
      } = req.body;

      // Validate required fields
      if (!code || !language || !problemId || !assessmentId) {
        return res.status(400).json({
          error: "Missing required fields",
          details: "code, language, problemId, and assessmentId are required",
        });
      }

      // Use studentId from request body or fall back to authenticated user
      const finalStudentId = studentId || req.user?.id;

      if (!finalStudentId) {
        return res.status(400).json({
          error: "Student ID is required",
          details: "Either provide studentId or ensure user is authenticated",
        });
      }

      console.log(
        `User ${req.user?.collegeId} (ID: ${finalStudentId}) is submitting code for problem ${problemId}`
      );

      // First run test cases to validate the submission
      let finalTestResults = testResults;
      let finalStatus = status;
      let finalScore = score;

      if (!testResults) {
        // If no test results provided, run them now
        try {
          const testCases = await prisma.testCases.findMany({
            where: { problemId },
          });

          if (testCases.length > 0) {
            // For submissions, include all test cases (including hidden) for grading
            // but the response will still filter out hidden ones
            const testResult = await runTestCases(
              code,
              language,
              testCases,
              true
            );
            finalTestResults = testResult;

            // Determine status based on ALL test results (including hidden)
            const totalPassed = testResult.allTestsPassed || testResult.passed;
            const totalTests = testResult.allTestsTotal || testResult.total;

            if (totalPassed === totalTests) {
              finalStatus = "COMPLETED";
            } else if (totalPassed > 0) {
              finalStatus = "FAILED";
            } else {
              finalStatus = "ERROR";
            }

            // Calculate score based on ALL tests (including hidden)
            const problem = await prisma.problems.findUnique({
              where: { id: problemId },
              select: { score: true },
            });

            if (problem?.score) {
              finalScore = Math.round(
                (totalPassed / totalTests) * problem.score
              );
            } else {
              finalScore = totalPassed === totalTests ? 100 : 0;
            }
          }
        } catch (testError) {
          console.error("Error running test cases for submission:", testError);
          finalStatus = "ERROR";
          finalScore = 0;
        }
      }

      // Save submission to database (upsert to handle unique constraint)
      try {
        const submission = await prisma.submission.upsert({
          where: {
            studentId_problemId: {
              studentId: finalStudentId,
              problemId: problemId,
            },
          },
          update: {
            code,
            language,
            status: finalStatus || "FAILED",
            score: finalScore || 0,
            executionTime: executionTime
              ? parseFloat(executionTime.toString())
              : null,
            memoryUsed: memoryUsed ? parseInt(memoryUsed.toString()) : null,
            errorMessage: errorMessage || null,
            testResults: finalTestResults
              ? JSON.stringify({
                  ...finalTestResults,
                  cases: finalTestResults.cases.filter(
                    (c: TestCaseResult) => !c.isHidden
                  ), // Store only visible test cases
                })
              : undefined,
            isSubmitted: true, // Mark as submitted when updating
          },
          create: {
            code,
            language,
            status: finalStatus || "FAILED",
            score: finalScore || 0,
            studentId: finalStudentId,
            problemId,
            executionTime: executionTime
              ? parseFloat(executionTime.toString())
              : null,
            memoryUsed: memoryUsed ? parseInt(memoryUsed.toString()) : null,
            errorMessage: errorMessage || null,
            testResults: finalTestResults
              ? JSON.stringify({
                  ...finalTestResults,
                  cases: finalTestResults.cases.filter(
                    (c: TestCaseResult) => !c.isHidden
                  ), // Store only visible test cases
                })
              : undefined,
            isSubmitted: true, // Mark as submitted when creating
          },
        });

        console.log(`Submission saved with ID: ${submission.id}`);

        // Return the saved submission
        res.status(201).json({
          success: true,
          message: "Submission saved successfully",
          isUpdate: submission.createdAt.getTime() !== new Date().getTime(), // Check if it was an update
          data: {
            id: submission.id,
            code: submission.code,
            language: submission.language,
            status: submission.status,
            score: submission.score,
            studentId: submission.studentId,
            problemId: submission.problemId,
            createdAt: submission.createdAt,
            executionTime: submission.executionTime,
            memoryUsed: submission.memoryUsed,
            errorMessage: submission.errorMessage,
            testResults: finalTestResults
              ? {
                  ...finalTestResults,
                  cases: finalTestResults.cases.filter(
                    (c: TestCaseResult) => !c.isHidden
                  ), // Return only visible test cases to client
                }
              : undefined,
          },
          submittedBy: req.user?.collegeId,
        });
      } catch (dbError) {
        console.error("Database error saving submission:", dbError);
        res.status(500).json({
          success: false,
          error: "Failed to save submission to database",
          details:
            dbError instanceof Error
              ? dbError.message
              : "Unknown database error",
        });
      }
    } catch (error) {
      console.error("Error in /submissions/coding:", error);
      res.status(500).json({
        success: false,
        error: "Internal server error",
        message: error instanceof Error ? error.message : "Unknown error",
      });
    }
  }
);

// Save submission (Protected - Admin/Professor only) - Legacy endpoint
app.post(
  "/submissions/save",
  authenticateToken,
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      // Check if user has admin privileges (you can modify this based on your role system)
      if (req.user?.role !== "admin") {
        return res.status(403).json({
          error: "Access denied",
          message: "Only administrators can save submissions directly",
        });
      }

      const submissionData = req.body;

      if (!submissionData) {
        return res.status(400).json({
          error: "Missing submission data",
        });
      }

      // Add user information to submission data
      const enrichedSubmissionData = {
        ...submissionData,
        savedBy: req.user?.id,
        savedByRole: req.user?.role,
        savedAt: new Date().toISOString(),
      };

      console.log(`Admin ${req.user?.collegeId} is saving submission data`);
      const result = await saveSubmissionAction(enrichedSubmissionData);

      if (result.success) {
        res.json({
          success: true,
          message: "Submission saved successfully",
          data: result.data,
          savedBy: req.user?.collegeId,
        });
      } else {
        res.status(400).json({
          success: false,
          error: result.error || "Failed to save submission",
        });
      }
    } catch (error) {
      console.error("Error in /submissions/save:", error);
      res.status(500).json({
        success: false,
        error: "Internal server error",
        message: error instanceof Error ? error.message : "Unknown error",
      });
    }
  }
);

// Health check route (Public)
app.get("/health", (req, res) => {
  res.json({ status: "OK", timestamp: new Date().toISOString() });
});

// Get user info (Protected)
app.get(
  "/auth/me",
  authenticateToken,
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      res.json({
        success: true,
        user: {
          id: req.user?.id,
          collegeId: req.user?.collegeId,
          name: req.user?.name,
          email: req.user?.email,
          role: req.user?.role,
          department: req.user?.department,
          batch: req.user?.batch,
          contact: req.user?.contact,
        },
      });
    } catch (error) {
      console.error("Error in /auth/me:", error);
      res.status(500).json({
        success: false,
        error: "Failed to get user information",
        message: error instanceof Error ? error.message : "Unknown error",
      });
    }
  }
);

// Test authentication endpoint (Protected)
app.get(
  "/auth/test",
  authenticateToken,
  async (req: AuthenticatedRequest, res: Response) => {
    res.json({
      success: true,
      message: "Authentication successful!",
      user: req.user?.collegeId,
      role: req.user?.role,
      timestamp: new Date().toISOString(),
    });
  }
);

// Start server
app.listen(PORT, () => {
  console.log(`🚀 Server is running on http://localhost:${PORT}`);
});

export default app;
