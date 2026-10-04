import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import SharePick from './SharePick';
import { parseSharedPick } from '../sharedPick';
beforeEach(() => {
 HTMLDialogElement.prototype.showModal = function() { this.setAttribute('open',''); };
 HTMLDialogElement.prototype.close = function() { this.removeAttribute('open'); };
 Object.defineProperty(navigator,'clipboard',{configurable:true,value:{writeText:jest.fn().mockResolvedValue()}});
 Object.defineProperty(navigator,'share',{configurable:true,writable:true,value:undefined});
});
const movie={id:671,title:'Harry Potter',canonical_slug:'harry-potter-2001'};
test('sharing freezes the one pick and explanation; request is excluded by default',async()=>{
 const {rerender}=render(<SharePick movie={movie} why="Warm adventure" prompt="With my daughter" />);
 fireEvent.click(screen.getByRole('button',{name:'Share this pick'}));
 expect(screen.getByLabelText('Include my request')).not.toBeChecked();
 fireEvent.click(screen.getByRole('button',{name:'Copy link'}));
 await waitFor(()=>expect(navigator.clipboard.writeText).toHaveBeenCalledTimes(1));
 const url=new URL(navigator.clipboard.writeText.mock.calls[0][0]);
 expect(parseSharedPick(url.search,671)).toEqual({v:1,id:671,why:'Warm adventure',brief:''});
 rerender(<SharePick movie={{...movie,id:672}} why="New pick" prompt="With my daughter" />);
 expect(parseSharedPick(url.search,671).why).toBe('Warm adventure');
 expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
});
test('explicit request inclusion appears in the native share destination, no vote flow',async()=>{
 navigator.share=jest.fn().mockResolvedValue();
 render(<SharePick movie={movie} why="Warm adventure" prompt="With my daughter" />);
 fireEvent.click(screen.getByRole('button',{name:'Share this pick'}));
 fireEvent.click(screen.getByLabelText('Include my request'));
 fireEvent.click(screen.getByRole('button',{name:'Share pick'}));
 await waitFor(()=>expect(navigator.share).toHaveBeenCalledTimes(1));
 const payload=navigator.share.mock.calls[0][0];
 expect(parseSharedPick(new URL(payload.url).search).brief).toBe('With my daughter');
 expect(payload.title).toBe('Tonight’s pick: Harry Potter');
 expect(payload.url).not.toMatch(/movie-night|choice=/);
});
test('busy picks cannot open sharing',()=>{
 render(<SharePick movie={movie} disabled />);
 expect(screen.getByRole('button',{name:'Share this pick'})).toBeDisabled();
});
