import importlib.util
from pathlib import Path
import unittest

spec = importlib.util.spec_from_file_location('packager', Path(__file__).with_name('package-dressed-update.py'))
packager = importlib.util.module_from_spec(spec)
spec.loader.exec_module(packager)


class DependencyClosure(unittest.TestCase):
    def test_missing_weekly_module_blocks_release(self):
        with self.assertRaisesRegex(ValueError, 'weekly-plan.js'):
            packager.verify_imports({'src/entrypoints/api.js': b'import { weeklyPlanSchema } from "../domain/planner/weekly-plan.js";'})

    def test_complete_imports_and_external_packages(self):
        packager.verify_imports({'src/entrypoints/api.js': b'import {z} from "zod"; export {x} from "../weekly.js"; import("../weekly.js");', 'src/weekly.js': b'export const x=1;'})


if __name__ == '__main__':
    unittest.main()
