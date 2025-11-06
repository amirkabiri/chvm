import { defineConfig } from 'tsup';
import packageJson from './package.json';
import { promises as fs } from 'fs';

function copyFiles(files: string[]): Promise<void> {
  return Promise.all(
    files.map(file => fs.copyFile(file, `./dist/${file}`))
  ).then(() => void 0);
}

async function createFinalPackageJson() {
  // Read the latest package.json to get the updated version
  const currentPackageJson = JSON.parse(
    await fs.readFile('./package.json', 'utf-8')
  );
  
  const newPackageJson = JSON.parse(JSON.stringify(currentPackageJson));
  delete newPackageJson.dependencies;
  delete newPackageJson.devDependencies;
  delete newPackageJson.scripts;
  delete newPackageJson.files;
  return {
    ...newPackageJson,
    main: './cli.cjs',
    bin: {
      chvm: './cli.cjs',
    },
  }
}

export default defineConfig({
  entry: ['src/cli.ts'],
  format: ['cjs'],
  shims: true,
  clean: true,
  minify: true,
  noExternal: Object.keys(packageJson.dependencies),
  onSuccess: async () => {
    await fs.writeFile(
      './dist/package.json',
      JSON.stringify(await createFinalPackageJson(), null, 2)
    );
    await copyFiles(['README.md', 'CHANGELOG.md']);
    console.log('Build successful');
  },
});
