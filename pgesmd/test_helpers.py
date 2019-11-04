"""Test the functions and methods in pgesmd.helpers."""

import unittest
import os
import time
import sqlite3

from pgesmd.helpers import (
    get_auth_file,
    parse_espi_data
)
from pgesmd.database import EnergyHistory


PROJECT_PATH = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
print(f'Testing in: {PROJECT_PATH}')


answers = [
           (1570086000, 3600, 1067300, 1067, '19/10/03'),
           (1570089600, 3600, 916900, 916, '19/10/03'),
           (1570093200, 3600, 912000, 912, '19/10/03'),
           (1570096800, 3600, 759100, 759, '19/10/03'),
           (1570100400, 3600, 594400, 594, '19/10/03'),
           (1570104000, 3600, 650500, 650, '19/10/03'),
           (1570107600, 3600, 676900, 676, '19/10/03'),
           (1570111200, 3600, 759600, 759, '19/10/03'),
           (1570114800, 3600, 695900, 695, '19/10/03'),
           (1570118400, 3600, 853500, 853, '19/10/03'),
           (1570122000, 3600, 1229500, 1229, '19/10/03'),
           (1570125600, 3600, 871100, 871, '19/10/03'),
           (1570129200, 3600, 826900, 826, '19/10/03'),
           (1570132800, 3600, 1042899, 1042, '19/10/03'),
           (1570136400, 3600, 1233600, 1233, '19/10/03'),
           (1570140000, 3600, 1115900, 1115, '19/10/03'),
           (1570143600, 3600, 1331000, 1331, '19/10/03'),
           (1570147200, 3600, 3363100, 3363, '19/10/03'),
           (1570150800, 3600, 4870100, 4870, '19/10/03'),
           (1570154400, 3600, 5534300, 5534, '19/10/03'),
           (1570158000, 3600, 5541900, 5541, '19/10/03'),
           (1570161600, 3600, 6296300, 6296, '19/10/03'),
           (1570165200, 3600, 5372200, 5372, '19/10/03'),
           (1570168800, 3600, 4148399, 4148, '19/10/03')
           ]


class TestHelpers(unittest.TestCase):
    """Test pgesmd.helpers."""

    def test_get_auth_file(self):
        """Test get_auth_file()."""
        self.assertEqual(get_auth_file('bad_path'), None)
        self.assertEqual(
            get_auth_file(f'{PROJECT_PATH}/test/auth/bad.json'), None)
        self.assertEqual(
            get_auth_file(f'{PROJECT_PATH}/test/auth/auth.json'), (
                '55555',
                'fake_client_id',
                'fake_client_secret',
                '/home/jp/pgesmd/test/cert/cert.crt',
                '/home/jp/pgesmd/test/cert/private.key'))

    def test_parse_espi(self):
        """Test parse_espi_data()."""
        xml = f'{PROJECT_PATH}/test/data/espi/espi_1_day.xml'
        for entry, answer in zip(parse_espi_data(xml), answers):
            self.assertEqual(entry, answer)

        xml = f'{PROJECT_PATH}/test/data/espi/espi_2_years.xml'
        dump = []
        for entry in parse_espi_data(xml):
            dump.append(entry)

        #  17,496 hours / 24 = 729 days of data
        self.assertEqual(len(dump), 17496)

        #  check first and last data points, see actual XML file
        self.assertEqual(dump[0], (1508396400, 3600, 446800, 446, '17/10/19'))
        self.assertEqual(dump[17495], (1571378400, 3600, 1643400, 1643,
                         '19/10/17'))
        start = time.strftime(
            '%Y-%m-%d %H:%M:%S',
            time.localtime(int(dump[0][0])))
        end = time.strftime(
            '%Y-%m-%d %H:%M:%S',
            time.localtime(int(dump[17495][0]) + int(dump[17495][1])))
        print(f"\nParsed two year data feed from {start} through {end}")

    def test_database_write(self):
        """Verify integrity of data after SQL INSERT."""
        query = "SELECT value FROM espi WHERE start=?"

        db = EnergyHistory(path='/test/data/energy_history_test.db')
        xml = f'{PROJECT_PATH}/test/data/espi/espi_2_years.xml'
        db.insert_espi_xml(xml)

        cur = db.cursor

        starts = [(1508396400, 446800), (1571378400, 1643400)]

        for start, answer in starts:
            cur.execute(query, (start,))
            result = cur.fetchall()
            self.assertEqual(result[0][0], answer)

        cur.execute('DROP TABLE espi')
        cur.execute('DROP TABLE daily')

    def test_database_daily_write(self):
        """Verify that daily baseline was calculated correctly."""
        db = EnergyHistory(path='/test/data/energy_history_test.db')
        xml = f'{PROJECT_PATH}/test/data/espi/espi_2_years.xml'
        db.insert_espi_xml(xml)

        cur = db.cursor

        cur.execute("SELECT watt_hours from espi WHERE date='17/10/19'")
        wh_readings = cur.fetchall()
        wh_readings.sort()
        baseline_ans = int(round(
            (wh_readings[0][0] + wh_readings[1][0] + wh_readings[2][0]) / 3))

        cur.execute("SELECT baseline FROM daily WHERE date='17/10/19'")
        baseline = cur.fetchall()[0][0]

        cur.execute("SELECT watt_hours from espi WHERE date='19/10/17'")
        wh_readings = cur.fetchall()
        wh_readings.sort()
        baseline_ans = int(round(
            (wh_readings[0][0] + wh_readings[1][0] + wh_readings[2][0]) / 3))

        cur.execute("SELECT baseline FROM daily WHERE date='19/10/17'")
        baseline = cur.fetchall()[0][0]

        self.assertEqual(baseline_ans, baseline)

        cur.execute('DROP TABLE espi')
        cur.execute('DROP TABLE daily')


if __name__ == '__main__':
    conn = sqlite3.connect(f'{PROJECT_PATH}/test/data/energy_history_test.db')
    cur = conn.cursor()
    cur.execute('DROP TABLE IF EXISTS espi')
    cur.execute('DROP TABLE IF EXISTS daily')

    unittest.main()
