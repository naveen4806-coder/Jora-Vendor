(function(){
 payInfoBlock=function(order){return ZorraPayment.html(order,'vendor');};
 const original=renderOrdersPanel;renderOrdersPanel=function(){original.apply(this,arguments);};
 // The existing online filter uses the legacy "online" value.
 const filter=document.getElementById('order-filter-pay');if(filter){const option=filter.querySelector('option[value="online"]');if(option)option.value='razorpay';}
})();
