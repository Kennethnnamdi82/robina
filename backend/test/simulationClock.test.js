import test from 'node:test';
import assert from 'node:assert/strict';
import {simulationBudget,MAX_STEPS_PER_SLICE} from '../src/missions/simulationClock.js';
const step=1/60;
test('250ms stalls retain all fifteen fixed steps while each work slice stays bounded',()=>{
  let remaining=0,total=0;
  for(let update=0;update<40;update++){
    let budget=simulationBudget(remaining,.25,step);
    do{
      assert.equal(budget.interrupted,false);assert.ok(budget.steps<=MAX_STEPS_PER_SLICE);
      total+=budget.steps;remaining=budget.remaining;
      budget=simulationBudget(remaining,0,step);
    }while(budget.steps>0);
  }
  assert.equal(total,600);assert.ok(remaining<step);
});
test('fractional elapsed time is retained without creating extra simulation time',()=>{
  let remaining=0,total=0,elapsed=0;
  for(const delta of [.015,.01,.075,.25,.001,.049]){
    elapsed+=delta;let budget=simulationBudget(remaining,delta,step);
    do{total+=budget.steps;remaining=budget.remaining;budget=simulationBudget(remaining,0,step);}while(budget.steps);
  }
  assert.ok(Math.abs(total*step+remaining-elapsed)<1e-9);
});
test('an unbounded backlog requires recovery instead of a spiral of catch-up or silent slow motion',()=>{
  assert.deepEqual(simulationBudget(.8,.3,step),{steps:0,remaining:0,interrupted:true});
});
