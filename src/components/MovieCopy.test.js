import React from 'react';import {render,screen} from '@testing-library/react';import MovieCopy from './MovieCopy';
test('renders marked movie titles as italics and keeps HTML inert',()=>{
 const {container}=render(<p><MovieCopy>A doorway gives *Backrooms* an odd premise. **Alien** is darker. &lt;script&gt;</MovieCopy></p>);
 expect(screen.getByText('Backrooms').tagName).toBe('EM');expect(screen.getByText('Alien').tagName).toBe('EM');
 expect(container.textContent).not.toMatch(/\*/);expect(container.querySelector('script')).toBeNull();
});
test('italicizes known titles without disturbing ordinary prose or punctuation',()=>{
 const {container}=render(<MovieCopy titles={['Harry Potter (2001)']}>Watch Harry Potter (2001) tonight.</MovieCopy>);
 expect(container.querySelector('em').textContent).toBe('Harry Potter (2001)');expect(container.textContent).toBe('Watch Harry Potter (2001) tonight.');
});
