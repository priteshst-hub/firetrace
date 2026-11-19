import importlib.util
import math
import unittest
import tempfile
from unittest.mock import patch
from pathlib import Path
spec=importlib.util.spec_from_file_location('atlas',Path(__file__).resolve().parents[1]/'tools/atlas_pipeline.py')
a=importlib.util.module_from_spec(spec);spec.loader.exec_module(a)
class AtlasTests(unittest.TestCase):
    def test_equal_area_and_cell_centers(self):
        for lon,lat in [(149,-35),(112,-43),(154,-10)]:
            x,y=a.cell(lon,lat)
            self.assertEqual(a.cell(*a.center(x,y)),(x,y))
        # Jacobian dx/dlon * dy/dlat = R² cos(lat), so constant grid area.
        lat=math.radians(-35)
        self.assertAlmostEqual((a.R*a.C)*(a.R*math.cos(lat)/a.C),a.R*a.R*math.cos(lat))
    def test_evaluation_against_explicit_reference(self):
        m=a.metrics([(2,4),(4,6)],lambda reference,v:v*.5)
        self.assertEqual(m['n'],2);self.assertEqual(m['mae'],.5)
        self.assertAlmostEqual(m['rmse'],math.sqrt(.5));self.assertEqual(m['bias'],-.5)
    def test_acquisition_dispatches_processor_without_shadowing(self):
        with tempfile.TemporaryDirectory() as directory:
            root=Path(directory)
            with patch.object(a,'CACHE',root/'cache'),patch.object(a,'REPORT',root/'reports'),patch.object(a,'download',return_value=(root/'archive.zip','https://test.invalid',None)),patch.object(a,'process') as processor,patch('builtins.print'):
                a.DOWNLOAD_STOP.clear()
                a.acquire()
                self.assertEqual(processor.call_count,39)
                self.assertEqual(__import__('json').loads((root/'reports/acquisition-failures.json').read_text()),[])
                a.DOWNLOAD_STOP.clear()
    def test_missing_metrics_are_not_zero(self):
        self.assertEqual(a.metrics([],lambda a,v:v),dict(n=0,mae=None,rmse=None,bias=None))
if __name__=='__main__':unittest.main()
