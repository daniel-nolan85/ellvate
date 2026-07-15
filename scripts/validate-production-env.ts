import {
  validateProductionEnvironment,
  type ProductionEnvironmentInput,
} from '../src/platform/environment/server-environment';

const issues = validateProductionEnvironment(
  process.env as unknown as ProductionEnvironmentInput,
);

if (issues.length > 0) {
  console.error('Production environment validation failed:');
  for (const issue of issues) {
    console.error(`- ${issue}`);
  }
  process.exit(1);
}

console.log('Production environment validation passed.');
