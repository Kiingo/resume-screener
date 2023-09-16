import type { Config } from '@jest/types';
import parentConfig from './jest.config.json';

const config: Config.InitialOptions = {};
export default {
  ...parentConfig,
  ...config
};
