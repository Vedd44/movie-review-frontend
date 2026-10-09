const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const HASH = /^[0-9a-f]{64}$/;
const CODE = /^[a-z][a-z0-9_]{0,63}$/;
const TERMINAL = ['sent', 'ignored', 'review_required'];

function storeError(code) {
  const error = new Error(code);
  error.code = code;
  return error;
}

// Only metadata crosses this boundary. Never attach Supabase error objects: they
// can include submitted values or infrastructure details in message/hint fields.
function createAdminEmailStore(db) {
  if (!db || typeof db.rpc !== 'function') throw storeError('forwarding_store_unavailable');

  function identity(emailId, token) {
    if (typeof emailId !== 'string' || typeof token !== 'string'
      || !UUID.test(emailId) || !UUID.test(token)) throw storeError('forwarding_store_invalid_identity');
    return { p_email_id: emailId, p_token: token };
  }

  async function rpc(name, args, statuses) {
    let result;
    try {
      result = await db.rpc(name, args);
    } catch {
      throw storeError('forwarding_store_unavailable');
    }
    if (result?.error) throw storeError('forwarding_store_unavailable');
    if (!statuses.includes(result?.data?.status)) throw storeError('forwarding_store_invalid_response');
    return { status: result.data.status };
  }

  function finish(emailId, token, action, outgoingId, code) {
    const args = identity(emailId, token);
    if ((action === 'sent' && outgoingId === null)
      || (outgoingId !== null && (typeof outgoingId !== 'string' || !UUID.test(outgoingId)))) {
      throw storeError('forwarding_store_invalid_identity');
    }
    if ((action !== 'sent' && code === null)
      || (code !== null && (typeof code !== 'string' || !CODE.test(code)))) throw storeError('forwarding_store_invalid_code');
    return rpc('admin_email_finish', {
      ...args, p_action: action, p_outgoing_email_id: outgoingId, p_code: code,
    }, [...TERMINAL, 'busy', ...(action === 'retry' ? ['released'] : [])]);
  }

  return {
    claim(emailId, token) {
      return rpc('admin_email_claim', identity(emailId, token), [...TERMINAL, 'claimed', 'busy']);
    },
    prepare(emailId, token, payloadHash) {
      const args = identity(emailId, token);
      if (typeof payloadHash !== 'string' || !HASH.test(payloadHash)) throw storeError('forwarding_store_invalid_hash');
      return rpc('admin_email_prepare', { ...args, p_payload_hash: payloadHash }, [...TERMINAL, 'ready', 'busy']);
    },
    sent: (emailId, token, outgoingId) => finish(emailId, token, 'sent', outgoingId, null),
    retry: (emailId, token, code) => finish(emailId, token, 'retry', null, code),
    ignore: (emailId, token, code) => finish(emailId, token, 'ignored', null, code),
    review: (emailId, token, code) => finish(emailId, token, 'review_required', null, code),
  };
}

module.exports = { createAdminEmailStore };
