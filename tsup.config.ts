import { defineConfig } from 'tsup';
import packageJson from './package.json';
import { promises as fs } from 'fs';

export default defineConfig({
  entry: ['src/cli.ts'],
  format: ['cjs'],
  shims: true,
  clean: true,
  minify: false,
  noExternal: Object.keys(packageJson.dependencies),
  onSuccess: async () => {
    let newPackageJson = JSON.parse(JSON.stringify(packageJson));
    delete newPackageJson.dependencies;
    delete newPackageJson.devDependencies;
    delete newPackageJson.scripts;
    delete newPackageJson.files;
    newPackageJson = {
      ...newPackageJson,
      main: './cli.cjs',
      bin: {
        chvm: './cli.cjs',
      },
    }
    await fs.writeFile('./dist/package.json', JSON.stringify(newPackageJson, null, 2));
    await fs.copyFile('./README.md', './dist/README.md');
    console.log('Build successful');
  },
});
