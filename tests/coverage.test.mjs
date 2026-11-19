import assert from 'node:assert/strict';
import test from 'node:test';
import {isCoverageQuestion,COVERAGE_ANSWER} from '../worker/coverage.ts';
test('coverage questions distinguish all three archives without model inference',()=>{
 for(const q of ['Why does FireTrace have only two years?', 'Why does FireTrace only have two years?', 'How many years of data?', 'Which years are available?', 'Does the Atlas cover 2001–2025?']) assert.equal(isCoverageQuestion(q),true,q);
 for(const q of ['How does cloud coverage affect MODIS?', 'Explain the holdout period']) assert.equal(isCoverageQuestion(q),false,q);
 for(const fact of ['2001–2025','2019–2020','COMMAND','experimental','not live alerts']) assert.ok(COVERAGE_ANSWER.includes(fact));
});
