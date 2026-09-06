(function(root){
 const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 function info(o){const p=o.payment||{},method=p.method||o.paymentMethod||'cod',cod=['cod','cash','cash on delivery'].includes(String(method).toLowerCase()),paid=p.status==='paid'&&p.verified===true;const label=cod?'Cash on Delivery':p.status==='refunded'?'Refunded':paid?'Paid Online':p.status==='failed'?'Payment Failed':'Payment Pending';return{cod,paid,label,status:cod?'cod':paid?'paid':p.status||'pending',total:Number(o.customerTotal??o.finalTotal??o.total??0),payment:p};}
 function collectionText(o){const p=info(o);return p.cod?'Cash on Delivery · Amount to Collect: ₹'+p.total.toLocaleString('en-IN'):p.paid?'PREPAID · Amount to Collect: ₹0':p.label+' · Do not collect cash; contact admin';}
 function html(o,role){const p=info(o);return '<div class="pay-info-block" style="padding:10px;border:1px solid var(--border,#ddd);border-radius:8px"><strong>'+esc(role==='delivery'?collectionText(o):p.label)+'</strong>'+(p.payment.instrument?'<div>Method: '+esc(p.payment.instrument)+'</div>':'')+(role==='customer'&&p.payment.razorpayPaymentId?'<small>Reference: …'+esc(p.payment.razorpayPaymentId.slice(-8))+'</small>':'')+'</div>';}
 root.ZorraPayment={info,html,collectionText,esc};
 if(typeof module!=='undefined')module.exports=root.ZorraPayment;
})(typeof window!=='undefined'?window:globalThis);
