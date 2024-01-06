/* eslint-disable no-console */
import { exec } from 'child_process';
import consola from 'consola';
import fs from 'fs';
import prompts from 'prompts';
import { promisify } from 'util';

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
  } catch (e) {
    const error = e as Error;
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

      const packages: {
        isDev: boolean;
        name: string;
        version: string;
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        dependenciesArray: any;
      }[] = [];

      for (const key of Object.keys(packageJson.dependencies)) {
        if (key.startsWith('@kiingo/')) {
          packages.push({
            isDev: false,
            name: key,
            version: packageJson.dependencies[key],
            dependenciesArray: packageJson.dependencies
          });
        }
      }
      for (const key of Object.keys(packageJson.devDependencies)) {
        if (key.startsWith('@kiingo/')) {
          packages.push({
            isDev: true,
            name: key,
            version: packageJson.devDependencies[key],
            dependenciesArray: packageJson.devDependencies
          });
        }
      }

      // Iterate through dependencies
      for (const p of packages) {
        const packageName = p.name;
        const isDev = p.isDev;
        let currentVersion = p.version;
        // Remove any leading ^ or ~
        if (currentVersion.startsWith('^') || currentVersion.startsWith('~')) {
          currentVersion = currentVersion.substring(1);
        }
        p.dependenciesArray[packageName] = currentVersion;
        consola.log(`Found Kiingo package: ${packageName}`);

        let targetVersion = '';
        await runCommand(`yarn info ${packageName}`, {
          onStdOut: (stdout) => {
            //consola.success(`${stdout}`);
            const getLastVersion = (str: string): string | null => {
              // Regular expression to match the versions array and capture the last version
              const regex = /versions:\s*\[\s*(?:'[^']+',\s*)*?'([^']+)'\s*\]/;

              // Execute the regex
              const matches = regex.exec(str);

              // If a match is found, return the captured group (last version)
              if (matches && matches[1]) {
                return matches[1];
              }

              // Return null if no match is found
              return null;
            };
            const targetVersionMaybe = getLastVersion(stdout);
            /*
            `yarn info ${packageName} versions`

            const getLastVersionFromString = (
              versionString: string
            ): string => {
              // Remove the leading and trailing brackets and split by comma
              const versions = versionString
                .slice(1, -1)
                .split(',')
                .map((s) => {
                  // Trim whitespace and strip single/double quotes
                  return s.trim().replace(/^['"]|['"]$/g, '');
                });

              if (versions.length === 0) {
                throw new Error('No versions available');
              }

              return versions[versions.length - 1];
            };

            // Find the latest version
            const targetVersionMaybe = getLastVersionFromString(stdout);
            */

            if (targetVersionMaybe) {
              // Use this version
              targetVersion = targetVersionMaybe;
            } else {
              throw new Error(`No versions found for package ${packageName}.`);
            }
          },
          shouldThrowError: false
        });

        if (targetVersion?.length) {
          if (forceUpdate || targetVersion !== currentVersion) {
            if (forceUpdate) {
              consola.log(
                `Force updating package: ${packageName} to ${targetVersion}...`
              );
            } else {
              consola.log(
                `${packageName} is on version ${currentVersion}. Updating to ${targetVersion}...`
              );
            }

            consola.log(`Uninstalling package: ${packageName}`);
            // Uninstall package using yarn
            await runCommand(`yarn remove ${packageName}`, {
              shouldThrowError: false
            });

            consola.log(`Re-adding package: ${packageName}@${targetVersion}`);
            successMessages.push(
              `Updated ${packageName} from ${currentVersion} to ${targetVersion}.`
            );
            await runCommand(
              `yarn add ${packageName}@${targetVersion}${
                isDev ? ' --dev' : ''
              }`,
              {
                shouldThrowError: false
              }
            );

            // Update the version in package.json cache
            p.dependenciesArray[packageName] = `${targetVersion}`;
            p.version = targetVersion;

            // Is this package in peer dependencies? If so, update it there too
            const peerDependencies = packageJson.peerDependencies;
            if (peerDependencies && peerDependencies[packageName]) {
              consola.log(
                `Updating peer dependency: ${packageName}@${targetVersion}`
              );
              peerDependencies[packageName] = targetVersion;
            }
          } else {
            consola.success(
              `${packageName} is already on version ${targetVersion}.`
            );
          }
        } else {
          consola.warn(`No target version found for ${packageName}.`);
        }
      }

      // Now let's detect whether any packages have dependencies that are
      // different versions (i.e. mismatched versions of the same package).

      // Key is dependency/package name, value is array of versions
      // If we find multiple versions of the same package, we've got a
      // version mismatch.
      const versionDependencies: {
        [dependencyName: string]: {
          // Key is The version of the dependency
          // Value is sourcePackageName (the package that has the dependency with this version)
          [version: string]: string[];
        }[];
      } = {};
      const addDependencies = (
        packageName: string,
        dependencies: { [key: string]: string }
      ) => {
        for (const dependencyName of Object.keys(dependencies)) {
          // We only care about @kiingo packages
          if (!dependencyName.startsWith('@kiingo/')) {
            continue;
          }

          const dependencyVersion = dependencies[dependencyName];
          if (!versionDependencies[dependencyName]) {
            versionDependencies[dependencyName] = [];
          }
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          if (!versionDependencies[dependencyName][dependencyVersion as any]) {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            (versionDependencies[dependencyName] as any)[
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              dependencyVersion as any
            ] = [];
          }

          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          (
            versionDependencies[dependencyName][
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              dependencyVersion as any
            ] as unknown as string[]
          ).push(packageName);
        }
      };

      // Add in this package as one whose dependencies we will also consider
      addDependencies(packageJson.name, {
        ...packageJson.dependencies,
        ...packageJson.devDependencies
      });

      for (const p of packages) {
        const packageName = p.name;
        const version = p.version;
        await runCommand(`yarn info ${packageName}@${version} dependencies`, {
          onStdOut: (stdout) => {
            const parseDependencyString = (
              dependencyString: string
            ): Record<string, string> => {
              const obj: Record<string, string> = {};

              // Remove the outer braces and split by lines
              const lines = dependencyString.trim().slice(1, -1).split(',');

              for (const line of lines) {
                // Split by the first colon to separate key and value
                let [key, value] = line.split(/:(.+)/);

                // Trim and remove extra quotes from key and value
                key = key.trim().replace(/^['"]|['"]$/g, '');
                value = value.trim().replace(/^['"]|['"]$/g, '');

                // Remove any leading ^ or ~
                if (value.startsWith('^') || value.startsWith('~')) {
                  value = value.substring(1);
                }

                obj[key] = value;
              }

              return obj;
            };

            const dependencies = parseDependencyString(stdout) as {
              [key: string]: string;
            };

            addDependencies(packageName, dependencies);
          }
        });
      }

      consola.log(`Checking dependency versions...`);

      // Now let's iterate through the dependencies
      let didFindAnyVersionMismatch = false;
      for (const dependencyName of Object.keys(versionDependencies)) {
        const dependencyVersions = versionDependencies[dependencyName];

        if (Object.keys(dependencyVersions).length > 1) {
          didFindAnyVersionMismatch = true;
          // We've got a version mismatch
          consola.error(
            `Version mismatch detected for dependency ${dependencyName}.`
          );
          for (const version of Object.keys(dependencyVersions)) {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const sourcePackages = dependencyVersions[
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              version as any
            ] as unknown as string[];
            consola.warn(
              `Version ${version} is used by the following package(s): ${sourcePackages.join(
                ', '
              )}`
            );
          }
        }
      }
      if (!didFindAnyVersionMismatch) {
        consola.success(`No version mismatches detected!`);
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
