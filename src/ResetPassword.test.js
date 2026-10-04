import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import ResetPassword from './ResetPassword';
import { useAuth } from './context/AuthContext';
jest.mock('./context/AuthContext',()=>({useAuth:jest.fn()}));
jest.mock('./seo',()=>({usePageMetadata:jest.fn(),buildBreadcrumbJsonLd:jest.fn()}));
test('an invalid recovery return offers a new link instead of a password form',()=>{
 const openAuthPrompt=jest.fn();
 useAuth.mockReturnValue({authReady:true,user:null,passwordRecoveryActive:true,recoverySession:null,clearPasswordRecovery:jest.fn(),openAuthPrompt,authNotice:{kind:'error',message:'That email link has expired.'}});
 render(<MemoryRouter><ResetPassword/></MemoryRouter>);
 expect(screen.queryByPlaceholderText('New password')).not.toBeInTheDocument();
 expect(screen.getByRole('alert')).toHaveTextContent('That email link has expired.');
 fireEvent.click(screen.getByRole('button',{name:'Send a new reset link'}));
 expect(openAuthPrompt).toHaveBeenCalledWith('password_recovery');
});
