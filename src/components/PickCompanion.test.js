import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import PickCompanion from './PickCompanion';
jest.mock('./TasteActionBar',()=>({onInteraction,disabled})=> <button disabled={disabled} onClick={()=>onInteraction('hidden', {active:true})}>Not for me</button>);
test('rejection feedback reuses a single refinement with no background fetch', () => {
  const onRefine=jest.fn();
  global.fetch=jest.fn();
  render(<PickCompanion movie={{id:1,title:'A movie'}} alternatives={[{id:2}]} onRefine={onRefine} />);
  expect(screen.queryByRole('button',{name:'Too long'})).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole('button',{name:'Not for me'}));
  fireEvent.click(screen.getByRole('button',{name:'Too long'}));
  expect(onRefine).toHaveBeenCalledTimes(1);
  expect(onRefine.mock.calls[0][0].id).toBe('shorter');
  expect(global.fetch).not.toHaveBeenCalled();
  delete global.fetch;
});
test('feedback cannot issue another refinement while a request is running', () => {
  const onRefine=jest.fn();const movie={id:1,title:'A movie'};
  const {rerender}=render(<PickCompanion movie={movie} onRefine={onRefine} />);
  fireEvent.click(screen.getByRole('button',{name:'Not for me'}));
  rerender(<PickCompanion movie={movie} onRefine={onRefine} disabled />);
  fireEvent.click(screen.getByRole('button',{name:'Too intense'}));
  expect(onRefine).not.toHaveBeenCalled();
});
test('shows one bounded adjustment row and resets rejection reasons for a new movie', () => {
  const onRefine=jest.fn();const refineActions=[{id:'lighter',label:'Lighter'},{id:'shorter',label:'Shorter'},{id:'different_angle',label:'Different angle'},{id:'darker',label:'Darker'}];
  const {rerender}=render(<PickCompanion movie={{id:1}} onRefine={onRefine} refineActions={refineActions} />);
  expect(screen.getByRole('button',{name:'Darker'})).not.toBeVisible();
  fireEvent.click(screen.getByRole('button',{name:'Shorter'}));
  expect(onRefine).toHaveBeenCalledWith(refineActions[1]);
  fireEvent.click(screen.getByRole('button',{name:'Not for me'}));
  expect(screen.getByText(/leave this movie out/)).toBeInTheDocument();
  rerender(<PickCompanion movie={{id:2}} onRefine={onRefine} refineActions={refineActions} />);
  expect(screen.queryByText(/leave this movie out/)).not.toBeInTheDocument();
});

test('chosen-to-watch is independent of Watched and recommendation requests',()=>{
 global.fetch=jest.fn();render(<PickCompanion movie={{id:99,title:'A movie'}} />);
 const choice=screen.getByRole('button',{name:'Choose this movie'});expect(choice).toHaveAttribute('aria-pressed','false');
 fireEvent.click(choice);expect(screen.getByRole('button',{name:'✓ Chosen to watch'})).toHaveAttribute('aria-pressed','true');
 expect(global.fetch).not.toHaveBeenCalled();
});
