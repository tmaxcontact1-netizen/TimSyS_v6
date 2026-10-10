import importlib.util
from pathlib import Path
import sqlite3
import tempfile
import unittest
from contextlib import contextmanager


@contextmanager
def connection(path):
    db = sqlite3.connect(path)
    try:
        with db:
            yield db
    finally:
        db.close()

spec = importlib.util.spec_from_file_location('reset_principaled', Path(__file__).with_name('reset-principaled.py'))
resetter = importlib.util.module_from_spec(spec)
spec.loader.exec_module(resetter)


class ResetTests(unittest.TestCase):
    def setUp(self):
        self.directory = tempfile.TemporaryDirectory()
        self.root = Path(self.directory.name)
        self.database = self.root / 'test.sqlite'
        with connection(self.database) as db:
            db.executescript('''
                CREATE TABLE users(id INTEGER PRIMARY KEY, username TEXT);
                INSERT INTO users VALUES(1,'owner');
                CREATE TABLE documents(id INTEGER PRIMARY KEY,app_id TEXT);
                INSERT INTO documents VALUES(1,'principal-ed'),(2,'researched');
                CREATE TABLE document_versions(id INTEGER PRIMARY KEY, document_id INTEGER REFERENCES documents(id),storage_key TEXT);
                INSERT INTO document_versions VALUES(1,1,'school.bin'),(2,2,'research.bin');
                CREATE TABLE nb_records(id TEXT PRIMARY KEY,app_id TEXT);
                INSERT INTO nb_records VALUES('real','principal-ed'),('other','researched');
                CREATE TABLE nb_revisions(record_id TEXT REFERENCES nb_records(id), revision INTEGER, PRIMARY KEY(record_id,revision));
                INSERT INTO nb_revisions VALUES('real',1),('other',1);
                CREATE TABLE calendar_layers(id INTEGER PRIMARY KEY,app_id TEXT);
                INSERT INTO calendar_layers VALUES(1,'principal-ed');
            ''')
        self.files = Path(str(self.database) + '.documents')
        self.files.mkdir()
        (self.files / 'school.bin').write_bytes(b'school source')
        (self.files / 'research.bin').write_bytes(b'other app source')

    def tearDown(self):
        self.directory.cleanup()

    def test_dry_run_does_not_mutate(self):
        original = self.database.read_bytes()
        result = resetter.reset(self.database, self.root / 'preview')
        self.assertFalse(result['applied'])
        self.assertEqual(original, self.database.read_bytes())
        self.assertTrue((self.files / 'school.bin').exists())

    def test_real_records_and_revisions_cleared_other_app_and_config_preserved(self):
        result = resetter.reset(self.database, self.root / 'recovery', True)
        with connection(self.database) as db:
            self.assertEqual(db.execute('select * from documents').fetchall(), [(2, 'researched')])
            self.assertEqual(db.execute('select * from nb_revisions').fetchall(), [('other', 1)])
            self.assertEqual(db.execute('select count(*) from users').fetchone()[0], 1)
            self.assertEqual(db.execute('select count(*) from calendar_layers').fetchone()[0], 1)
            self.assertEqual(db.execute('pragma foreign_key_check').fetchall(), [])
        self.assertTrue((self.files / 'research.bin').exists())
        self.assertFalse((self.files / 'school.bin').exists())
        self.assertEqual((self.root / 'recovery/documents/school.bin').read_bytes(), b'school source')
        with connection(result['backup']) as db:
            self.assertEqual(db.execute('select count(*) from documents').fetchone()[0], 2)

    def test_cross_app_reference_refuses_reset(self):
        with connection(self.database) as db:
            db.executescript("CREATE TABLE foreign_links(id INTEGER PRIMARY KEY,app_id TEXT,document_id INTEGER REFERENCES documents(id)); INSERT INTO foreign_links VALUES(1,'researched',1);")
        with self.assertRaisesRegex(RuntimeError, 'another app'):
            resetter.reset(self.database, self.root / 'blocked', True)
        self.assertTrue((self.files / 'school.bin').exists())

    def test_missing_document_rolls_back(self):
        (self.files / 'school.bin').unlink()
        with self.assertRaisesRegex(RuntimeError, 'storage path missing'):
            resetter.reset(self.database, self.root / 'blocked', True)
        with connection(self.database) as db:
            self.assertEqual(db.execute('select count(*) from documents').fetchone()[0], 2)


if __name__ == '__main__':
    unittest.main()
