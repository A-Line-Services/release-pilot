/**
 * Release Pilot - GitHub Action Entry Point
 *
 * Framework-agnostic release automation with multi-package support.
 *
 * @module index
 */

import * as core from '@actions/core';
import { run } from './main.js';

// Run the action
run().catch((error) => {
  if (error instanceof Error) {
    core.setFailed(error.message);
  } else {
    core.setFailed(String(error));
  }
});
