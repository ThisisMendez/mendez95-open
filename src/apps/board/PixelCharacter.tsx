import {portraitSprite,type Appearance} from './appearance';
import './portraits.css';
/** Frame accents are independent of the portrait's original skin and clothing. */
export function PixelCharacter({characterId,colorId}:Appearance){
  const sprite=portraitSprite(characterId);
  return <span className={`lounge-character lounge-color-${colorId}`} aria-hidden="true" style={{backgroundImage:`url(${sprite.src})`,backgroundSize:`${sprite.columns*100}% ${sprite.rows*100}%`,backgroundPosition:`${sprite.column*100/(sprite.columns-1)}% ${sprite.row*100/(sprite.rows-1)}%`}}/>;
}
