/* eslint-disable no-console */
import { exec } from 'child_process';
import { promisify } from 'util';
import consola from 'consola';

const execAsync = promisify(exec);

const runCommand = async (command: string) => {
  try {
    const { stdout, stderr } = await execAsync(command);
    consola.log(stdout);
    if (stderr?.length) {
      consola.info(`StdErr: ${stderr}`);
    }
  } catch (error) {
    consola.error(`Error executing command: ${error}`);
    throw error;
  }
};

const listStagedFiles = async () => {
  consola.log('Showing files staged for commit...');
  const { stdout } = await execAsync('git status --porcelain');
  const stagedFiles = stdout
    .split('\n')
    .filter((line) => line.startsWith('A ') || line.startsWith('M '));
  if (stagedFiles.length > 0) {
    consola.log('Staged files:');
    consola.log(stagedFiles.join('\n'));
  } else {
    consola.log('No files staged for commit.');
  }
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
const commit = async (commitMessage: string) => {
  if (!commitMessage?.length) {
    throw new Error('Commit message is required.');
  }
  await stage();
  consola.log('Committing changes...');
  await runCommand(`git commit -m "${commitMessage}"`);
  consola.success(`Successfully committed changes.`);
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

const commitRebasePush = async (commitMessage: string) => {
  await commit(commitMessage);

  await pullRebase();

  await push();
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
    } else {
      consola.error('Invalid command type.');
    }
  } catch (error) {
    consola.error(`An error occurred: ${error}`);
  }
};

main();
