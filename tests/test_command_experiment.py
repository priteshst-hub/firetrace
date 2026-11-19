import importlib.util
from pathlib import Path
import unittest

spec = importlib.util.spec_from_file_location('experiment', Path(__file__).resolve().parents[1] / 'tools/command_experiment.py')
experiment = importlib.util.module_from_spec(spec)
spec.loader.exec_module(experiment)


class ExperimentTests(unittest.TestCase):
    def test_one_to_one_tie_and_window(self):
        self.assertEqual(experiment.pair_windows({60: 2, 61: 3}, {59: 4, 90: 5}),
                         [(60, 59, 2, 4), (61, 90, 3, 5)])
        self.assertEqual(experiment.pair_windows({60: 2}, {91: 4}), [])
        self.assertEqual(experiment.pair_windows({}, {60: 1}), [])

    def test_fit_and_metrics(self):
        rows = [(2, 4), (4, 8)]
        self.assertEqual(experiment.fit(rows), .5)
        self.assertEqual(experiment.metrics(rows, .5), dict(n=2, mae=0, rmse=0, bias=0))
        self.assertEqual(experiment.metrics(rows, 1)['mae'], 3)


if __name__ == '__main__':
    unittest.main()
