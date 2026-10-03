import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import PickCompanion from './PickCompanion';
jest.mock('./TasteActionBar',()=>()=> <div>Existing taste actions</div>);
test('feedback reuses a single existing refinement and has no background fetch', () => {
  const onRefine=jest.fn();
  global.fetch=jest.fn();
  render(<PickCompanion movie={{id:1,title:'A movie'}} alternatives={[{id:2}]} onRefine={onRefine} />);
  expect(global.fetch).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole('button',{name:'Too long'}));
  expect(onRefine).toHaveBeenCalledTimes(1);
  expect(onRefine.mock.calls[0][0].id).toBe('shorter');
  expect(global.fetch).not.toHaveBeenCalled();
  delete global.fetch;
});
test('feedback cannot issue another refinement while a request is running', () => {
  const onRefine=jest.fn();
  render(<PickCompanion movie={{id:1,title:'A movie'}} onRefine={onRefine} disabled />);
  fireEvent.click(screen.getByRole('button',{name:'Too intense'}));
  expect(onRefine).not.toHaveBeenCalled();
});
