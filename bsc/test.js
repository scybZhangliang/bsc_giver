var originalAmountToBuyWith = '0.007' + Math.random().toString().slice(2,7);
console.log(Date.now())
console.log(Math.round(Date.now()/1000)+60*20)
const sleep = function (ms){
    return new Promise(resolve => setTimeout(resolve, ms))
}
let arr = [];
arr.push(1,2,3,4,5,6,7,8,9)
const itr = async function(){
    while(1){
        for(let i=0;i<arr.length;i++){
            console.log('request:'+i)
            await sleep(100)
        }
        await sleep(1000)
    }

}
/*
const request = async function(){
    for(let i=0;i<10000;i++){
        console.log('request:'+i)
        await sleep(100)
    }
}*/
//tr();
for (let i = 10; i < 21; i++) {
    arr.push(i)
}
/*for (let i = 20; i < 30; i++) {
    arr.push(i)
}*/
 function add() {
    for (let i = 40; i < 60; i++) {
        console.log('adding ${i}')
        arr.push(i)
        //await sleep(100)
    }
}
// add()
function mainLogic(){
    setTimeout(function(){
        console.log("im reading")
    },10000)
    setTimeout(function(){
        console.log("im sleeping")
    },5000)
}
mainLogic()
setTimeout(function(){
    console.log("i'm outline")
})
console.log("i'm the ending")
