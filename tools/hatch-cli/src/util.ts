import path from 'path';
import fs from 'fs-extra';
import ora from 'ora';
import chalk from 'chalk';
import {eraseLine} from 'ansi-escapes';
import commander from 'commander';
import tmp from 'tmp';
import {CompletableFuture} from '@launchtray/hatch-util';
import replace from 'replace-in-file';

interface CopyDirOptions {
  srcPath: string;
  dstPath: string;
  name: string;
  isProject?: boolean;
}

export const withSpinner = async (message: string, task: () => Promise<void>): Promise<void> => {
  const spinner = ora(message).start();
  try {
    await task();
  } finally {
    spinner.stop();
    process.stdout.write(eraseLine);
  }
};

export const createProject = async (parentDirectory: string, projectName: string) => {
  if (!projectName) {
    throw new Error('Project name must be specified');
  }
  const projectPath = process.cwd() + '/' + projectName;
  await createFromTemplate({
    srcPath: templateDir(parentDirectory),
    dstPath: projectPath,
    name: projectName,
    isProject: true,
  });
  console.log(chalk.green('Created \'' + projectPath + '\''));
  console.log('Now would be a good time to cd into the project and install dependencies (e.g. via npm, yarn, or rush)');
};

export const projectCreator = (parentDirectory: string) => {
  return (projectName: string) => {
    return createProject(parentDirectory, projectName);
  }
};

export const createModule = async (parentDirectory: string, moduleName: string, extension = 'ts') => {
  if (!moduleName) {
    throw new Error('Module name must be specified');
  }
  const modulePath = process.cwd() + '/' + moduleName + '.' + extension;
  await createFromTemplate({
    srcPath: templateFile(parentDirectory, extension),
    dstPath: modulePath,
    name: moduleName,
  });
  console.log(chalk.green('Created \'' + modulePath + '\''));
};

export const moduleCreator = (parentDirectory: string, extension = 'ts') => {
  return (moduleName: string) => {
    return createModule(parentDirectory, moduleName, extension);
  }
};

export const createFromTemplate = async ({srcPath, dstPath, name, isProject}: CopyDirOptions) => {
  const templateName = path.basename(path.dirname(path.resolve(srcPath)));
  if (fs.existsSync(dstPath)) {
    throw new Error('Failed to create ' + dstPath + ' as it already exits!');
  }
  await withSpinner('Creating \'' + name + '\'', async () => {
    const tempFileFuture: CompletableFuture<[string, () => void]> = new CompletableFuture<[string, () => void]>();
    if (isProject) {
      tmp.dir({unsafeCleanup: true}, (err, path, cleanUp) => {
        if (err) {
          cleanUp();
          tempFileFuture.completeExceptionally(err);
        }
        tempFileFuture.complete([path, cleanUp]);
      });
    } else {
      tmp.file((err, path, fd, cleanUp) => {
        if (err) {
          cleanUp();
          tempFileFuture.completeExceptionally(err);
        }
        tempFileFuture.complete([path, cleanUp]);
      });
    }
    const [tempFilePath, cleanUp] = await tempFileFuture.get();
    try {
      await fs.copy(srcPath, tempFilePath);
      if (isProject) {
        await replace({
          files: tempFilePath + '/**/*',
          from: /HATCH_CLI_TEMPLATE_VAR_projectName/g,
          to: name,
        });
        await replace({
          files: tempFilePath + '/package.json',
          from: '@launchtray/hatch-template-' + templateName,
          to: name
        })
      } else {
        await replace({
          files: tempFilePath,
          from: /HATCH_CLI_TEMPLATE_VAR_moduleName/g,
          to: name,
        });
      }
      await fs.move(
        path.resolve(tempFilePath, 'dot-idea', 'HATCH_CLI_TEMPLATE_VAR_projectName.iml'),
        path.resolve(tempFilePath, 'dot-idea', `${name}.iml`)
      );
      await fs.move(path.resolve(tempFilePath, 'dot-idea'), path.resolve(tempFilePath, '.idea'));
      await fs.move(path.resolve(tempFilePath, 'dot-gitignore'), path.resolve(tempFilePath, '.gitignore'));
      await fs.copy(tempFilePath, dstPath);
    } finally {
      cleanUp();
    }
  });
};

export const templatePath = (parentDirectory: string, templateFile: string) => {
  return path.resolve(parentDirectory, '../../../src/templates/', path.basename(parentDirectory), templateFile);
};

export const templateDir = (parentDirectory: string, dirName = 'template') => {
  return templatePath(parentDirectory, dirName);
};

export const templateFile = (parentDirectory: string, extension = 'ts', moduleName = 'template') => {
  return templatePath(parentDirectory, moduleName + '.' + extension);
};

export const runCommander = () => {
  commander.parseAsync(process.argv)
    .catch((err) => {
      console.error(chalk.red(err.message));
      commander.help();
    });
};
