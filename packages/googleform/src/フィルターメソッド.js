function filter1() {
  let names = ['sato', 'suzuki', 'takahasi', 'tanaka'];

  let newNames = [];
  for(let name of names){
    if (name.includes('s')){
     newNames.push(name);
    }
  }

  console.log(newNames);
}

function filter2() {
  let names = ['sato', 'suzuki', 'takahasi', 'tanaka'];

  names = names.filter(function(name){
   return name.includes('s');
  });

  console.log(names);
}

function filter3() {
  let names = ['sato', 'suzuki', 'takahasi', 'tanaka'];

  names = names.filter(name => name.includes('s'));

  console.log(names);
}
