import React from 'react';
import {render,screen,fireEvent,waitFor} from '@testing-library/react';
import SharePick from './SharePick';
const movie={id:671,title:'Harry Potter',canonical_slug:'harry-potter-2001'};
beforeEach(()=>{
 HTMLDialogElement.prototype.showModal=function(){this.setAttribute('open','');};
 HTMLDialogElement.prototype.close=function(){this.removeAttribute('open');};
 Object.defineProperty(navigator,'clipboard',{configurable:true,value:{writeText:jest.fn().mockResolvedValue()}});
 Object.defineProperty(navigator,'share',{configurable:true,writable:true,value:undefined});
 global.fetch=jest.fn().mockResolvedValue({ok:true,json:async()=>({path:'/p/Abcdef123456'})});
});
afterEach(()=>{delete global.fetch;});
test('creates no background share until opened; shares a short link without the request by default',async()=>{
 render(<SharePick movie={movie} why="Warm adventure" prompt="With my daughter" />);
 expect(global.fetch).not.toHaveBeenCalled();
 fireEvent.click(screen.getByRole('button',{name:'Share this pick'}));
 await waitFor(()=>expect(screen.getByRole('button',{name:'Copy link'})).toBeEnabled());
 expect(JSON.parse(global.fetch.mock.calls[0][1].body)).toEqual({v:1,id:671,why:'Warm adventure',brief:''});
 expect(screen.getByLabelText(/Include what I asked for/)).not.toBeChecked();
 fireEvent.click(screen.getByRole('button',{name:'Copy link'}));
 await waitFor(()=>expect(navigator.clipboard.writeText).toHaveBeenCalledWith(expect.stringMatching(/\/p\/Abcdef123456$/)));
});
test('request inclusion is explicit and native sharing uses the already prepared link',async()=>{
 navigator.share=jest.fn().mockResolvedValue();
 render(<SharePick movie={movie} why="Warm adventure" prompt="With my daughter" />);
 fireEvent.click(screen.getByRole('button',{name:'Share this pick'}));
 await waitFor(()=>expect(screen.getByRole('button',{name:'Share pick'})).toBeEnabled());
 fireEvent.click(screen.getByLabelText(/Include what I asked for/));
 await waitFor(()=>expect(global.fetch).toHaveBeenCalledTimes(2));
 await waitFor(()=>expect(screen.getByRole('button',{name:'Share pick'})).toBeEnabled());
 expect(JSON.parse(global.fetch.mock.calls[1][1].body).brief).toBe('With my daughter');
 fireEvent.click(screen.getByRole('button',{name:'Share pick'}));
 await waitFor(()=>expect(navigator.share).toHaveBeenCalledTimes(1));
 expect(navigator.share.mock.calls[0][0].url).toMatch(/\/p\/Abcdef123456$/);
 expect(global.fetch).toHaveBeenCalledTimes(2);
});
test('storage failure keeps sharing disabled and provides a retry',async()=>{
 global.fetch.mockRejectedValueOnce(Error('Offline'));
 render(<SharePick movie={movie} why="Warm adventure" />);
 fireEvent.click(screen.getByRole('button',{name:'Share this pick'}));
 expect(await screen.findByRole('button',{name:'Try again'})).toBeInTheDocument();
 expect(screen.getByRole('button',{name:'Copy link'})).toBeDisabled();
 fireEvent.click(screen.getByRole('button',{name:'Try again'}));
 await waitFor(()=>expect(screen.getByRole('button',{name:'Copy link'})).toBeEnabled());
});
test('busy picks cannot open sharing',()=>{
 render(<SharePick movie={movie} disabled />);
 expect(screen.getByRole('button',{name:'Share this pick'})).toBeDisabled();
});
