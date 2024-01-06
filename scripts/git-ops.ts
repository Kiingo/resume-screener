/* eslint-disable no-console */
import { exec } from 'child_process';
import { promisify } from 'util';
import consola from 'consola';
import prompts from 'prompts';
import fs from 'fs';

const execAsync = promisify(exec);

const runCommand = async (
  command: string,
  options?: {
    onError?: (error: Error) => void;
    onStdOut?: (stdout: string) => void;
    shouldThrowError?: boolean | ((error: Error) => boolean);
  }
): Promise<boolean> => {
  if (!options) {
    options = {};
  }
  try {
    const { stdout, stderr } = await execAsync(command);
    if (options.onStdOut) {
      options.onStdOut(stdout);
    } else {
      consola.log(stdout);
    }

    if (stderr?.length) {
      consola.info(`StdErr: ${stderr}`);
    }
    return true;
  } catch (error) {
    consola.error(`Error executing command: ${error}`);
    options.onError?.(error);

    if (
      options.shouldThrowError === true ||
      (typeof options.shouldThrowError === 'function' &&
        options.shouldThrowError(error))
    ) {
      throw error;
    }
    return false;
  }
};

const listStagedFiles = async () => {
  consola.log('Showing files staged for commit...');
  const { stdout } = await execAsync('git status --porcelain');
  const lines = stdout.split('\n');

  const files: {
    added: string[];
    modified: string[];
    deleted: string[];
  } = {
    added: [],
    modified: [],
    deleted: []
  };

  for (const line of lines) {
    if (line.startsWith('A ')) {
      files.added.push(line.substring(3));
    } else if (line.startsWith('M ')) {
      files.modified.push(line.substring(3));
    } else if (line.startsWith('D ')) {
      files.deleted.push(line.substring(3));
    }
  }

  const stagedFiles = stdout
    .split('\n')
    .filter((line) => line.startsWith('A ') || line.startsWith('M '));
  if (stagedFiles.length > 0) {
    consola.log('Staged files:');
    consola.log(stagedFiles.join('\n'));
  } else {
    consola.log('No files staged for commit.');
  }
  return files;
};
const listUnstagedFiles = async () => {
  consola.log('Showing files unstaged for commit...');
  await runCommand('git status --porcelain --untracked-files=no');
  consola.success(`Successfully listed files unstaged for commit.`);
};

const stage = async () => {
  consola.log('Staging all files...');
  await runCommand('git add .');

  await listStagedFiles();
  consola.success(`Successfully staged all files.`);
};
const unstage = async () => {
  consola.log('Unstaging all files...');
  await runCommand('git reset');

  await listUnstagedFiles();
  consola.success(`Successfully unstaged all files.`);
};
const commit = async (commitMessage: string): Promise<boolean> => {
  if (!commitMessage?.length) {
    throw new Error('Commit message is required.');
  }
  await stage();

  const staged = await listStagedFiles();
  if (staged.deleted.length > 0) {
    // Ask user to confirm deletion of files
    consola.warn(
      `The following files will be deleted in this commit:\n${staged.deleted.join(
        '\n'
      )}`
    );

    const { confirm } = await prompts({
      type: 'confirm',
      name: 'confirm',
      message: 'Are you sure you want to delete these files?',
      initial: false
    });
    if (!confirm) {
      consola.log('Aborting commit.');
      return false;
    }
  }

  if (
    staged.added.length <= 0 &&
    staged.modified.length <= 0 &&
    staged.deleted.length <= 0
  ) {
    consola.log('No files staged for commit.');
    return true;
  }

  consola.log('Committing changes...');
  await runCommand(`git commit -m "${commitMessage}"`);
  consola.success(`Successfully committed changes.`);

  return true;
};
const pullMerge = async () => {
  consola.log('Pulling latest changes from remote...');
  await runCommand('git pull');
  consola.success(`Successfully pulled latest changes from remote.`);
};
const pullRebase = async () => {
  consola.log('Pulling latest changes from remote...');
  await runCommand('git pull --rebase');
  consola.success(`Successfully pulled latest changes from remote.`);
};
const push = async () => {
  consola.log('Pushing local changes to remote...');
  await runCommand('git push');
  consola.success(`Successfully pushed local changes to remote.`);
};
const rebasePush = async () => {
  await pullRebase();
  await push();
};

const commitRebasePush = async (commitMessage: string): Promise<boolean> => {
  const didCommit = await commit(commitMessage);
  if (!didCommit) {
    return false;
  }

  await pullRebase();

  await push();
  return true;
};

const refreshPackages = async ({ forceUpdate }: { forceUpdate: boolean }) => {
  // Use fs to find the package.json file
  consola.log(`Reading directory...`);
  const files = fs.readdirSync('./');
  const successMessages: string[] = [];
  for (const file of files) {
    if (file === 'package.json') {
      consola.log(`Found package.json file: ${file}`);
      // Read package.json
      const data = fs.readFileSync(`./${file}`, 'utf8');
      const packageJson = JSON.parse(data);

      // Iterate through dependencies
      for (const key of Object.keys(packageJson.dependencies)) {
        if (key.startsWith('@kiingo/')) {
          let currentVersion = packageJson.dependencies[key];
          // Remove any leading ^ or ~
          if (
            currentVersion.startsWith('^') ||
            currentVersion.startsWith('~')
          ) {
            currentVersion = currentVersion.substring(1);
          }
          consola.log(`Found Kiingo package: ${key}`);

          let targetVersion = '';
          await runCommand(`yarn info ${key}`, {
            onStdOut: (stdout) => {
              //consola.success(`${stdout}`);
              const getLastVersion = (str: string): string | null => {
                // Regular expression to match the versions array and capture the last version
                const regex =
                  /versions:\s*\[\s*(?:'[^']+',\s*)*?'([^']+)'\s*\]/;

                // Execute the regex
                const matches = regex.exec(str);

                // If a match is found, return the captured group (last version)
                if (matches && matches[1]) {
                  return matches[1];
                }

                // Return null if no match is found
                return null;
              };

              // Find the latest version
              const targetVersionMaybe = getLastVersion(stdout);
              if (targetVersionMaybe) {
                // Use this version
                targetVersion = targetVersionMaybe;
              } else {
                throw new Error(`No versions found for package ${key}.`);
              }
            },
            shouldThrowError: false
          });

          if (targetVersion?.length) {
            if (forceUpdate || targetVersion !== currentVersion) {
              if (forceUpdate) {
                consola.log(
                  `Force updating package: ${key} to ${targetVersion}...`
                );
              } else {
                consola.log(
                  `${key} is on version ${currentVersion}. Updating to ${targetVersion}...`
                );
              }

              consola.log(`Uninstalling package: ${key}`);
              // Uninstall package using yarn
              await runCommand(`yarn remove ${key}`, {
                shouldThrowError: false
              });

              consola.log(`Re-adding package: ${key}@${targetVersion}`);
              successMessages.push(
                `Updated ${key} from ${currentVersion} to ${targetVersion}.`
              );
              await runCommand(`yarn add ${key}@${targetVersion}`, {
                shouldThrowError: false
              });
            } else {
              consola.success(`${key} is already on version ${targetVersion}.`);
            }
          } else {
            consola.warn(`No target version found for ${key}.`);
          }
        }
      }
    }
  }
  for (const message of successMessages) {
    consola.success(message);
  }
};

const main = async () => {
  try {
    const commandType = process.argv[2];
    const commitMessage = process.argv[3];

    if (commandType === 'commit-rebase-push') {
      await commitRebasePush(commitMessage);
    } else if (commandType === 'commit') {
      await commit(commitMessage);
    } else if (commandType === 'stage') {
      await stage();
    } else if (commandType === 'unstage') {
      await unstage();
    } else if (commandType === 'pull') {
      await pullMerge();
    } else if (commandType === 'pull-rebase') {
      await pullRebase();
    } else if (commandType === 'rebase-push') {
      await rebasePush();
    } else if (commandType === 'push') {
      await push();
    } else if (commandType === 'list-staged') {
      await listStagedFiles();
    } else if (commandType === 'list-unstaged') {
      await listUnstagedFiles();
    } else if (commandType === 'refresh-packages') {
      await refreshPackages({
        forceUpdate: false
      });
    } else if (commandType === 'refresh-packages-force') {
      await refreshPackages({
        forceUpdate: true
      });
    } else {
      consola.error('Invalid command type.');
    }
  } catch (error) {
    consola.error(`An error occurred: ${error}`);
  }
};

main();
